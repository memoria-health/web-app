<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (16.2.6) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Key Next.js 16 changes that bit us:
- `middleware.ts` → `proxy.ts` (rename, same idea)
- `cookies()` and `headers()` are **async** — must `await cookies()` / `await headers()`
- `params` and `searchParams` in page props are **async** (Promise)
- `useSearchParams()` requires a `<Suspense>` boundary or `force-dynamic` — page **fails to build** without one
<!-- END:nextjs-agent-rules -->

## Dev mode hydration is broken right now

Next.js 16.2.6 + Turbopack + React 19 has a regression where **client components don't hydrate in `pnpm dev`** (top-level module code runs, but `useEffect`/event handlers never fire). `pnpm build && pnpm start` works fine.

For local iteration, run a production build. The E2E suite (`pnpm test:e2e`) builds first automatically.
