import { env } from '@/lib/env';
import { APIError } from './errors';

export type TokenProvider = () => Promise<string | null> | string | null;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  signal?: AbortSignal;
}

// Server: hit FastAPI directly. Browser: go through /backend rewrite so
// requests stay same-origin (FastAPI has no CORS middleware).
const isBrowser = typeof window !== 'undefined';
const baseUrl = isBrowser ? '/backend' : env.BACKEND_URL;

export class NemaraAPI {
  constructor(private readonly tokenProvider: TokenProvider) {}

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const token = await this.tokenProvider();
    const headers = new Headers({
      'Content-Type': 'application/json',
      // ngrok free tier shows an HTML "are you sure you want to visit"
      // interstitial (ERR_NGROK_6024) when it sees a Mozilla-style UA.
      // The page returns 200 with HTML, JSON.parse blows up, and the UI
      // silently shows an error. This header is the documented opt-out.
      // iOS doesn't need it (its UA is already not Mozilla-like).
      // Production points at a real domain so this is a no-op outside
      // local dev.
      'ngrok-skip-browser-warning': 'true',
    });
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let url = `${baseUrl}${path}`;
    if (opts.query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null) params.set(k, String(v));
      }
      const q = params.toString();
      if (q) url += `?${q}`;
    }

    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      cache: 'no-store',
    });

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!res.ok) throw new APIError(res.status, text, path);
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }
}
