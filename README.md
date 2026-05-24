# nemara-caregiver-web

A web dashboard for the Nemara caregiver workflow. Sister to
[`nemara-caregiver-app`](../nemara-caregiver-app) — same backend, same auth,
same data — just in a browser.

## What it does

- Sign in with the same Supabase Auth account as the iOS apps
- Watch the live grid of LiveKit video tiles for the patient's room
- Stream of detection events (Supabase Realtime)
- Manage cameras: list, add (6-digit pairing code), remove
- Manage detectors: list, toggle on/off, adjust sensitivity, create custom, edit, delete

A single "default" patient is created automatically on first sign-in so the
patient concept is hidden from the UI. Multi-patient support is left for v2.

## Stack

- Next.js 16.2.6 (App Router, Turbopack)
- React 19
- TypeScript
- Tailwind CSS v4
- `@supabase/ssr` for auth + cookie session
- `@livekit/components-react` for the video grid

## Prereqs

The backend stack from `nemara-backend` must be running.

```bash
cd ../nemara-backend && make fresh-seed
```

That spins up Supabase on `:54341/54342/54343`, FastAPI on `:8002`, and ngrok
in front of `:8002`. Then paste the printed ngrok URL into LiveKit Cloud.

## Run

```bash
pnpm install
# IMPORTANT: dev mode is currently broken (see AGENTS.md).
# Build and start in production mode for working UI:
pnpm build && pnpm start
```

Then open http://127.0.0.1:3000. Sign in with the seeded caregiver:

- **Email:** `jane@patel.co`
- **Password:** `Mar9aret!2024`

## Env vars (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54341
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
NEXT_PUBLIC_NEMARA_BACKEND_URL=http://127.0.0.1:8002
NEXT_PUBLIC_LIVEKIT_URL=wss://nemara-pdx0uelu.livekit.cloud
```

Same Supabase + LiveKit project as the iOS apps. JWTs minted by Supabase Auth
are accepted by the FastAPI backend without extra config.

## Tests

```bash
pnpm test:unit   # vitest — 25 tests covering API client, time, pairing utils
pnpm test:int    # bash + curl smoke test against the running backend
pnpm test:e2e    # Playwright — auth, cameras, detectors flows
pnpm test        # run all three in sequence
```

E2E auto-builds + starts the app in production mode (see AGENTS.md for why).

## Architecture notes

### CORS workaround
`nemara-backend` (FastAPI) doesn't set CORS headers. Server components fetch
the backend directly. Client components fetch through a Next.js rewrite at
`/backend/:path*` so requests stay same-origin. Browser → `/backend/v1/me` →
Next.js edge → `http://127.0.0.1:8002/v1/me`. Bearer JWT passes through.

### Auto-patient
The (app) layout (`app/(app)/layout.tsx`) checks the caregiver and patient
state on every request, provisioning both if missing. New signups get a
"Default" patient automatically; the backend auto-seeds the four preset
detectors with it.

### Single source of truth: the FastAPI backend
This app does no LLM work, no detector pipeline, no clip archival. It is
*just a view* over the backend's data, identical in semantics to the iOS
caregiver app. Whenever a contract changes in the backend, update
`lib/api/types.ts` to match.

## Out of scope (vs. caregiver iOS app)

Deliberately cut to keep v1 simple:

- LiveKit Talk mode (broadcaster role, audio gating, swipe-to-transfer)
- Audio waveform during call
- Patient photo upload
- Event review workflow (`opened` / `reviewed` / `review_choice`)
- Per-patient roster (multi-patient picker)
- iOS-style serif/paper theme

The dark zinc theme matches the original (now retired) `nemara-dashboard`.
