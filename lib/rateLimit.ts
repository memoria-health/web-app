import 'server-only';

/* Reusable rate limiting for route handlers.
 *
 * Two of these routes (/api/insight/briefing, /api/insight/chat) call
 * paid models on the company OpenAI and Google accounts. Nothing capped
 * how often. Any signed-in caregiver — or anyone holding a stolen
 * session cookie — could call them in a loop and run up the bill.
 *
 * Usage is one guard at the top of a handler:
 *
 *   const limited = await enforceRateLimit(req, BRIEFING_LIMIT);
 *   if (limited) return limited;
 *
 * Shape deliberately mirrors the backend's src/api/rate_limit.py so the
 * two systems are read the same way:
 *
 *   RateLimitPolicy  what the limit is     (data)
 *   RateLimitStore   where counters live   (interface)
 *   InMemorySlidingWindow  the default     (one implementation)
 *   enforceRateLimit  how it is applied    (guard returning a Response)
 *
 * SERVERLESS CAVEAT, and it is a real one. On Vercel each lambda
 * instance holds its own counters, so the effective ceiling is
 * (instances x limit) rather than (limit). That still converts an
 * unbounded spend into a bounded one, which is the point, but it is not
 * a precise quota. Making it exact needs shared state (Upstash Redis or
 * Vercel KV) — swap in a RateLimitStore backed by either and no route
 * changes. That seam is why the store is an interface with one method
 * rather than a module-level Map.
 */

export type RateLimitPolicy = {
  /** Namespaces counters so two policies never share a bucket. */
  name: string;
  limit: number;
  windowSeconds: number;
};

export interface RateLimitStore {
  /** Record a hit; false means the caller is over the limit. */
  allow(key: string, now?: number): boolean;
  /** Whole seconds until `key` frees up (>= 1), for Retry-After. */
  retryAfter(key: string, now?: number): number;
}

export class InMemorySlidingWindow implements RateLimitStore {
  private hits = new Map<string, number[]>();
  private lastSweep = 0;
  /* Sweeping is O(keys) and runs on a hot path, so amortize it. */
  private static readonly SWEEP_INTERVAL_MS = 60_000;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string, now: number = Date.now()): boolean {
    this.maybeSweep(now);
    const cutoff = now - this.windowMs;
    /* A true sliding window, not a fixed bucket: fixed buckets let a
     * caller spend the full limit at 0:59 and again at 1:01, i.e. 2x
     * the intended rate straight through the boundary. */
    const kept = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (kept.length >= this.limit) {
      this.hits.set(key, kept);
      return false;
    }
    kept.push(now);
    this.hits.set(key, kept);
    return true;
  }

  retryAfter(key: string, now: number = Date.now()): number {
    const hits = this.hits.get(key);
    if (!hits || hits.length === 0) return 1;
    return Math.max(1, Math.ceil((hits[0] + this.windowMs - now) / 1000));
  }

  /** Drop keys with nothing left inside the window. Without this, a
   * caller rotating identities grows the map forever — which turns the
   * limiter itself into a memory-exhaustion vector. */
  private maybeSweep(now: number): void {
    if (now - this.lastSweep < InMemorySlidingWindow.SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    const cutoff = now - this.windowMs;
    for (const [k, times] of this.hits) {
      if (times.length === 0 || times[times.length - 1] <= cutoff) this.hits.delete(k);
    }
  }

  /** Key count, for tests. Not part of RateLimitStore. */
  trackedKeys(): number {
    return this.hits.size;
  }
}

/* One store per policy, created on first use. Keyed by policy name so
 * two policies never share counters. */
const stores = new Map<string, RateLimitStore>();

function storeFor(policy: RateLimitPolicy): RateLimitStore {
  let s = stores.get(policy.name);
  if (!s) {
    s = new InMemorySlidingWindow(policy.limit, policy.windowSeconds * 1000);
    stores.set(policy.name, s);
  }
  return s;
}

/* Identify the caller.
 *
 * Prefer the authenticated user: these routes sit behind proxy.ts, so a
 * caller is a real caregiver, and limiting per-user is both fairer and
 * harder to evade than per-IP (one user cannot escape by changing
 * networks, and a household behind one NAT is not throttled as one).
 *
 * Falls back to the address Vercel's edge vouched for. `x-real-ip` is
 * set by the platform. For `x-forwarded-for` we take the RIGHT-most
 * entry: the proxy appends what it actually saw, so reading the
 * left-most (the usual idiom) would let a caller spoof a fresh identity
 * on every request and never hit the limit.
 */
export function callerKey(headers: Headers, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const realIp = headers.get('x-real-ip');
  if (realIp) return `ip:${realIp}`;
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return `ip:${parts[parts.length - 1]}`;
  }
  /* Nothing identifiable: one shared bucket. Fails closed (everyone
   * shares one budget) rather than open (everyone unlimited). */
  return 'ip:unknown';
}

/** Returns a 429 Response when the caller is over the limit, else null. */
export async function enforceRateLimit(
  req: Request,
  policy: RateLimitPolicy,
  userId?: string | null,
): Promise<Response | null> {
  const store = storeFor(policy);
  const key = `${policy.name}:${callerKey(req.headers, userId)}`;
  if (store.allow(key)) return null;
  return new Response(JSON.stringify({ error: 'rate_limited' }), {
    status: 429,
    headers: {
      'content-type': 'application/json',
      'retry-after': String(store.retryAfter(key)),
    },
  });
}

/* ── Policies ──────────────────────────────────────────────────────── */

/* Each call is one paid generation. A caregiver opening Home triggers
 * exactly one, and the client caches per patient per day, so 20/min is
 * far above real use while making a spend loop pointless. */
export const BRIEFING_RATE_LIMIT: RateLimitPolicy = {
  name: 'insight_briefing',
  limit: 20,
  windowSeconds: 60,
};

/* Chat is a multi-turn agent loop — several model calls per message and
 * the most expensive endpoint here. A person types a handful of
 * messages a minute at most. */
export const CHAT_RATE_LIMIT: RateLimitPolicy = {
  name: 'insight_chat',
  limit: 30,
  windowSeconds: 60,
};
