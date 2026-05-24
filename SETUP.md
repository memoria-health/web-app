# Nemara — full-stack setup (for a new developer or an LLM)

This guide brings up the **complete Nemara stack** on a fresh Mac so you can
sign into the web dashboard, see live video from a wall phone, and watch the
Gemini-powered detector pipeline tick in real time.

It assumes nothing — just macOS with an internet connection.

## What this stack is

Four repos make up the system. Each plays a single, distinct role.

| Repo | What it is | Runs on |
|---|---|---|
| **`nemara-backend`** | FastAPI service + Supabase local + LiveKit subscriber-bot + Gemini/OpenAI detector pipeline | macOS process (uvicorn :8002) + Docker (Supabase) + ngrok |
| **`nemara-caregiver-web`** | This repo. Next.js 16 web dashboard for the caregiver — sign in, live video grid, real-time LLM detection feed, camera + detector management | macOS process (Next.js :3000) |
| **`nemara-caregiver-app`** | iOS SwiftUI app — same workflows as the web dashboard, but on iPhone | iPhone (Xcode → physical device or simulator) |
| **`NemaraCam`** | iOS wall-phone app that publishes camera + microphone to LiveKit Cloud | iPhone (physical device, mounted on a wall) |

You can run the system with just **`nemara-backend` + `nemara-caregiver-web` + `NemaraCam`** — the iOS caregiver app is optional (the web dashboard does the same thing).

The data flow:

```
            ┌──────────────────────┐
            │  iPhone (NemaraCam)  │  publishes camera + mic + motion heartbeat
            └──────────┬───────────┘  to a LiveKit Cloud room (patient_<id>)
                       │
                       ▼
            ┌──────────────────────┐
            │   LiveKit Cloud      │  ────webhook────▶ nemara-backend
            └──────────┬───────────┘  (participant_joined/left, egress_ended)
                       │
                       ▼ video + audio + data
            ┌──────────────────────┐
            │   nemara-backend     │  detector worker joins room as viewer,
            │   (FastAPI :8002)    │  pulls frames every 10s, sends to Gemini,
            │   + Supabase local   │  writes analyses + events to Postgres
            └──────────┬───────────┘
                       │ Supabase Realtime (postgres_changes)
                       ▼
            ┌──────────────────────┐
            │ nemara-caregiver-web │  reads patient/cameras/events via REST,
            │   (Next.js :3000)    │  subscribes to live updates via Realtime
            └──────────────────────┘
```

---

## 0. Prereqs (one-time, ~15 min)

```bash
# Homebrew tooling
brew install uv supabase ngrok xcodegen pnpm node
brew install --cask docker

# Open Docker Desktop once so Supabase local can use it
open -a Docker
# (wait for the whale icon to be steady)

# ngrok free tier — sign up + grab your authtoken from
# https://dashboard.ngrok.com/get-started/your-authtoken
ngrok config add-authtoken <YOUR_TOKEN>

# LiveKit CLI (only needed for debugging stuck rooms)
brew install livekit-cli
```

You also need accounts (or invites) for:

- **GitHub** — to clone the 4 private repos (`aryamandarda/nemara-backend`,
  `aryamandarda/nemara-caregiver-app`, `potaton00b/NemaraCam`, `potaton00b/nemara-caregiver-web`)
- **LiveKit Cloud** — added as a member of the existing project
  (`wss://nemara-pdx0uelu.livekit.cloud`) so you can update the webhook URL
- **Apple Developer Team** (only if you want to build the iOS apps on a
  physical device — change the bundle ID prefix in `project.yml` if you're
  not on the original team `V8N59CF74G`)

---

## 1. Clone all four repos into one folder

```bash
mkdir -p ~/Documents/code/nemara
cd ~/Documents/code/nemara

git clone https://github.com/aryamandarda/nemara-backend.git
git clone https://github.com/aryamandarda/nemara-caregiver-app.git
git clone https://github.com/potaton00b/NemaraCam.git
git clone https://github.com/potaton00b/nemara-caregiver-web.git
```

> Adjust the path if you put them somewhere else — every command below
> uses paths relative to your current working directory.

---

## 2. Bring up the backend stack

`nemara-backend`'s `make fresh-seed` target is the one-command-does-everything:
it starts Supabase locally, applies the schema, seeds demo data
(caregiver `jane@patel.co` + patient Maggie + 3 demo cameras + 4 detectors +
historical events), starts uvicorn, starts ngrok, and prints the public
webhook URL you'll paste into LiveKit Cloud.

```bash
cd nemara-backend
make install        # `uv sync` — installs Python deps
make fresh-seed     # full stack up + demo seed
```

At the end of the output you'll see (in yellow):

```
Action needed: paste this webhook URL into LiveKit Cloud →
  https://<random>.ngrok-free.dev/v1/livekit/webhooks
```

### 2a. Configure LiveKit Cloud webhook (one manual step)

1. Open https://cloud.livekit.io → select the `nemara-pdx0uelu` project
2. Settings → Webhooks → either Edit an existing entry or **Add new endpoint**
3. URL: paste the ngrok URL above (including the `/v1/livekit/webhooks` path)
4. Signing API key: select the key whose ID matches the backend's
   `NEMARA_LIVEKIT_API_KEY` value in `nemara-backend/.env`
   (the only one in the dropdown, usually `APITxi4QucycnEW`)
5. Save

> ngrok URLs change every time you re-run `make fresh-seed`. To make the URL
> permanent, reserve a free domain at https://dashboard.ngrok.com/domains
> and edit `scripts/local-start.sh` step 6 to add `--domain=<your>.ngrok-free.app`.

### 2b. Smoke-test the backend

```bash
# Backend health
curl http://127.0.0.1:8002/health
# → {"status":"ok"}

# Supabase Studio (browse the DB visually)
open http://127.0.0.1:54343
```

---

## 3. Run the web dashboard (`nemara-caregiver-web`)

```bash
cd ../nemara-caregiver-web
pnpm install

# IMPORTANT: dev mode (`pnpm dev`) currently has a Turbopack + React 19
# hydration regression on this Next.js version (16.2.6). Use production mode.
pnpm build && pnpm start
```

The dashboard is now at **http://127.0.0.1:3000**.

Sign in with the seeded caregiver:

- **Email:** `jane@patel.co`
- **Password:** `Mar9aret!2024`

You should land on the home page showing the live video grid placeholder
("Waiting for cameras to join the room…") and the events feed with a few
historical seeded events (Possible fall, Agitation episode, etc.).

### What you'll see once a camera is paired

- **Live video grid** — capped at 672px wide (`max-w-2xl`)
- **Live LLM analyses** — one row added every ~10 seconds while the camera is
  active. Each row shows: provider badge (gemini/openai/skipped), 👤 people
  count, motion/still, open/closed state, the Gemini-generated description,
  and any detection badges (FALL · 85%, WANDERING · 60%, AGITATION, MEDICATION)
  with their reasoning text
- **Promoted events** — sparse, only when a detector crosses confidence
  threshold + dedup (the user-facing alert log)

---

## 4. Build the wall-phone app (`NemaraCam`) on an iPhone

You need a physical iPhone (NemaraCam needs the camera + mic) and an Apple
Developer Team selected in Xcode.

```bash
cd ../NemaraCam
xcodegen --spec project.yml  # generates NemaraCam.xcodeproj
open NemaraCam.xcodeproj
```

In Xcode:

1. Select the `NemaraCam` target → **Signing & Capabilities** → pick your
   Apple Developer Team. If you're not on team `V8N59CF74G`, edit
   `project.yml` to change the bundle ID prefix (e.g. `com.yourname.nemara.camera`)
   and re-run `xcodegen`.
2. Connect a physical iPhone, ⌘R to build & install.
3. On first launch, grant **Camera**, **Microphone**, and **Local Network**
   permissions when prompted.
4. **Tap the gear icon in PairingView** and set the backend URL to your Mac's
   LAN address. You have two options:
   - `http://Sunnys-MacBook-Air.local:8002` (Bonjour name — survives router
     IP changes)
   - `http://10.0.0.20:8002` (your Mac's current LAN IP — find it in
     System Settings → Wi-Fi → Details next to "IP Address")
   Make sure the iPhone is on the same Wi-Fi as your Mac.

### 4a. Pair the wall phone with the web dashboard

1. In the web dashboard: **Cameras → + Add Camera** → name it (e.g. "Living
   room") → **Generate code**. You get a 6-digit code with a 10-min countdown.
2. In NemaraCam on the iPhone: type the code into PairingView, submit.
3. Within ~2 seconds NemaraCam should swap to live capture, the web dashboard
   live grid should populate, and the backend should start ticking.

---

## 5. Build the iOS caregiver app (`nemara-caregiver-app`) — optional

The iOS caregiver app does the same things as the web dashboard, in case you
prefer the iPhone experience. Skip if you only want the web.

```bash
cd ../nemara-caregiver-app
xcodegen generate
open NemaraCaregiver.xcodeproj
```

In Xcode:

1. Signing & Capabilities → pick your Apple Developer Team (and change
   bundle ID prefix if not on `V8N59CF74G`).
2. **Edit Scheme → Run → Environment Variables** — if running on a physical
   iPhone, override:
   - `NEMARA_BACKEND_URL=http://Sunnys-MacBook-Air.local:8002`
   - `SUPABASE_URL=http://Sunnys-MacBook-Air.local:54341`
   (For the iOS simulator, the defaults `127.0.0.1:8002` / `127.0.0.1:54341`
   work — no overrides needed.)
3. ⌘R to build & run.
4. Sign in with `jane@patel.co` / `Mar9aret!2024`.

---

## 6. Daily operations cheat sheet

```bash
# Backend stack (Supabase + uvicorn + ngrok)
cd nemara-backend
make fresh-seed     # full reset + seed (wipes DB)
make fresh          # full reset, no seed
make down           # stop everything
make dev            # foreground uvicorn — see logs live in this terminal
tail -f .dev/backend.log    # if backend was started in background

# Web dashboard (Next.js)
cd nemara-caregiver-web
pnpm build && pnpm start    # rebuild + serve in prod mode
lsof -ti:3000 | xargs kill  # stop

# Clear stuck LiveKit room (releases ghost workers / cameras)
cd nemara-backend
ENV=.env
export LIVEKIT_URL=$(grep '^NEMARA_LIVEKIT_URL=' "$ENV" | cut -d= -f2-)
export LIVEKIT_API_KEY=$(grep '^NEMARA_LIVEKIT_API_KEY=' "$ENV" | cut -d= -f2-)
export LIVEKIT_API_SECRET=$(grep '^NEMARA_LIVEKIT_API_SECRET=' "$ENV" | cut -d= -f2-)
lk room delete "patient_<patient-uuid>" -y

# ngrok inspector — see every webhook request in real time
open http://127.0.0.1:4040
```

---

## 7. What to expect in the backend log when things are working

Watch `nemara-backend/.dev/backend.log` (background) or your `make dev`
terminal (foreground).

```
INFO src.api.livekit_webhooks: livekit_webhook participant_joined room=patient_... identity=cam_...
INFO src.services.detection.worker: detector_worker ensure_room_joined ...
INFO src.services.detection.room_worker: room_worker.start room=...
INFO src.services.detection.room_worker: room_worker.connected ... identity=detector_worker_...
INFO src.services.detection.room_worker: room_worker.video_subscribed ...
INFO src.services.detection.room_worker: room_worker.audio_subscribed ...

(every 10 seconds:)
INFO src.services.detection.camera_ingest: worker cam=... START detectors=['agitation', 'fall', 'medication', 'wandering'] motion=True prior_state=open buffered_frames=72 buffered_audio_chunks=140
INFO google_genai.models: AFC is enabled with max remote calls: 10.
INFO src.services.detection.camera_ingest: worker cam=... DONE provider=gemini people=True(1) motion=True state=open/0 events_fired=0 dedup=0
```

`START detectors=[...] motion=True` + `DONE provider=gemini ... people=True(1)` is the healthy state.

`SKIP closed-state, no motion` means the camera state machine has decided
nothing's happening and is short-circuiting the LLM call to save Gemini
quota. Wave at the camera to trigger motion and re-open the state.

---

## 8. Tests

The web dashboard has three test layers:

```bash
cd nemara-caregiver-web
pnpm test:unit      # 25 vitest unit tests (API client, time helpers, pairing format)
pnpm test:int       # bash + curl smoke test against the running backend stack
pnpm test:e2e       # 7 Playwright tests (login, cameras list/add, detectors list/toggle/create)
pnpm test           # all three in sequence
```

E2E tests automatically build + start the app in prod mode. They require the
backend stack to be running (`make fresh-seed`).

---

## 9. Architecture references

If you want to dig deeper:

- **Detector pipeline architecture** — `nemara-backend/ARCHITECTURE.md`
- **iOS caregiver app architecture** — `nemara-caregiver-app/ARCHITECTURE.md`
- **NemaraCam architecture** — `NemaraCam/ARCHITECTURE.md`
- **Web dashboard architecture notes** — see `nemara-caregiver-web/README.md`
  section "Architecture notes"

The most important concepts to understand:

- **State machine** (`nemara-backend/src/services/detection/state_machine.py`) —
  per-camera open/closed transitions. Motion alone opens; closing requires
  6 consecutive ticks of no motion AND no people.
- **Tick loop** (`camera_ingest.py:_tick_loop`) — fires every 10s in parallel
  (fire-and-forget); each tick analyzes the last 15s window, so consecutive
  ticks overlap by 5s.
- **Gemini sampling** (`providers/gemini.py`) — `NEMARA_GEMINI_VIDEO_FPS=5`
  in `.env` makes Gemini sample at 5fps (75 frames per 15s window) instead
  of the default 1fps.
- **CORS workaround** (`nemara-caregiver-web/next.config.ts`) — FastAPI has
  no CORS headers, so client-side fetches go through a Next.js rewrite at
  `/backend/:path*`.

---

## 10. Common issues

| Problem | Cause | Fix |
|---|---|---|
| Backend log only shows uvicorn startup lines, no detector logs | LiveKit webhook URL stale (ngrok changed) | Re-paste the new ngrok URL into LiveKit Cloud webhook config |
| Backend log shows `room_worker.disconnected ... DuplicateIdentity` looping | Stale ghost workers in the LiveKit room from a previous unclean shutdown | Stop everything (`make down`), `lk room delete ...`, restart |
| Web dashboard's Live LLM analyses feed stays empty after motion | Wall phone disconnected mid-pairing OR backend uvicorn died OR your browser tab is stale | Check `lsof -ti:8002`; force-quit NemaraCam + reopen; hard-refresh the browser (⌘⇧R) |
| Two Next.js processes running on :3000, browser sees old build | Background `pnpm start` from previous session survived a kill | `lsof -ti:3000 \| xargs kill -9`, then `pnpm build && pnpm start` |
| "Failed to fetch" in browser console when adding cameras / toggling detectors | FastAPI CORS missing AND `next.config.ts` rewrite not in place | Verify `next.config.ts` has the `/backend/:path*` rewrite and that you rebuilt |
| Gemini calls all return `provider=skipped` | Camera state is `closed` from no motion — system is saving quota | Wave at the camera to trigger motion; state will flip to `open` and Gemini calls resume |

---

That's everything. If something's still broken, `nemara-backend/.dev/backend.log` and the browser dev tools console are the two places that tell you what's actually happening.
