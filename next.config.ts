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
  // pose-detection (used by SkeletonView) statically imports `@mediapipe/pose`
  // for BlazePose, which we never use (MoveNet only). That package is a non-ESM
  // UMD bundle Turbopack can't resolve, so alias it to an empty stub. Safe: the
  // BlazePose path is never invoked.
  turbopack: {
    resolveAlias: {
      '@mediapipe/pose': './lib/stubs/mediapipe-pose.ts',
    },
  },
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
