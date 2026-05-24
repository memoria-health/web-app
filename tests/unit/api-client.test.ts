import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// env.ts requires NEXT_PUBLIC_* — set them before importing api/core.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54341';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_test';
process.env.NEXT_PUBLIC_NEMARA_BACKEND_URL = 'http://127.0.0.1:8002';
process.env.NEXT_PUBLIC_LIVEKIT_URL = 'wss://test.livekit.cloud';

const { NemaraAPI } = await import('@/lib/api/core');
const { APIError } = await import('@/lib/api/errors');

describe('NemaraAPI', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches bearer token to Authorization header', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"ok":true}', { status: 200 }),
    );
    const api = new NemaraAPI(() => 'abc.def.ghi');
    await api.request('/v1/me');
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('Authorization')).toBe(
      'Bearer abc.def.ghi',
    );
  });

  it('omits Authorization when token is null', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{}', { status: 200 }),
    );
    const api = new NemaraAPI(() => null);
    await api.request('/v1/anonymous');
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).has('Authorization')).toBe(false);
  });

  it('serializes query params and skips null/undefined', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{}', { status: 200 }),
    );
    const api = new NemaraAPI(() => null);
    await api.request('/v1/events', {
      query: { limit: 10, cursor: undefined, filter: 'all' },
    });
    const [url] = fetchMock.mock.calls[0];
    // happy-dom defines window, so core.ts picks the browser branch and
    // the URL is the /backend rewrite path (proxied through Next.js).
    expect(url).toBe('/backend/v1/events?limit=10&filter=all');
  });

  it('returns undefined for 204', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    const api = new NemaraAPI(() => null);
    const result = await api.request<void>('/v1/x', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('throws APIError on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"detail":"nope"}', { status: 401 }),
    );
    const api = new NemaraAPI(() => null);
    await expect(api.request('/v1/me')).rejects.toBeInstanceOf(APIError);
  });

  it('serializes JSON body and sets Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"id":"1"}', { status: 200 }),
    );
    const api = new NemaraAPI(() => 'jwt');
    await api.request('/v1/patients', {
      method: 'POST',
      body: { preferred_name: 'Maggie' },
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"preferred_name":"Maggie"}');
    expect((init.headers as Headers).get('Content-Type')).toBe(
      'application/json',
    );
  });
});
