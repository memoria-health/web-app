# feat/insight-merge — unified web app (2026-08-02)
caregiver-web + memoria-insight merged. Live preview:
https://memoria-care-unified.vercel.app (SEPARATE Vercel project
"memoria-app" — the existing prod project/domains are untouched).
IA: person chip (1 patient = static, N = picker + Everyone) · tabs
Home/Live/Ask/Explore/Settings · insight code namespaced under
components/insight, lib/insight, app/api/insight.
Security: every insight route tenant-scopes via backend /v1/patients with
the session token (401 anon, 403 foreign); scoped responses are
Cache-Control: private. Overlaps feat/web-customs-visibility in 6 files
(layout, 2 patient pages, globals.css, package.json, lockfile) — all
additive here; merge AFTER that wave lands on main.
Full details: nemara-backend/docs/plans/2026-08-02-sunny-handover.md
