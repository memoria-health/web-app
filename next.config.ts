import type { NextConfig } from 'next';

// The FastAPI backend doesn't set CORS headers, so browser-side fetch()
// from this app's origin (:3000) to the backend (:8002) fails with
// "Failed to fetch". We proxy /backend/:path* through the Next.js
// edge to the real backend so all client-side requests stay same-origin.
//
// Server components still hit the backend directly via NEXT_PUBLIC_NEMARA_BACKEND_URL
// (no CORS check in server-to-server fetches).
const backendUrl =
  process.env.NEXT_PUBLIC_NEMARA_BACKEND_URL ?? 'http://127.0.0.1:8002';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
