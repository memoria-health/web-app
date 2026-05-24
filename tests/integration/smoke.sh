#!/usr/bin/env bash
# tests/integration/smoke.sh — end-to-end curl smoke test against a running
# nemara-backend + Supabase. Run after `make fresh-seed` in the backend.
#
# Exits non-zero on first failure.

set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54341}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8002}"
EMAIL="${TEST_EMAIL:-jane@patel.co}"
PASSWORD="${TEST_PASSWORD:-Mar9aret!2024}"
ANON_KEY="${ANON_KEY:-sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH}"

CB=$'\033[34m'; CG=$'\033[32m'; CR=$'\033[0m'; CY=$'\033[33m'
fail() { printf "%sFAIL%s %s\n" "$CY" "$CR" "$*" >&2; exit 1; }
ok()   { printf "%sok%s   %s\n" "$CG" "$CR" "$*"; }
step() { printf "%s▸%s    %s\n" "$CB" "$CR" "$*"; }

# 1. backend health
step "backend /health"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")
[[ "$code" == "200" ]] || fail "/health returned $code"
ok "backend healthy"

# 2. backend /ready (db)
step "backend /ready"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/ready")
[[ "$code" == "200" ]] || fail "/ready returned $code"
ok "backend ready (db connected)"

# 3. Supabase auth — sign in
step "supabase sign-in: $EMAIL"
login=$(curl -sS -X POST \
  "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
JWT=$(echo "$login" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("access_token",""))')
[[ -n "$JWT" ]] || fail "no access_token in response: $login"
ok "got JWT (${#JWT} chars)"

auth=(-H "Authorization: Bearer $JWT")

# 4. GET /v1/me
step "GET /v1/me"
me=$(curl -fsS "${auth[@]}" "$BACKEND_URL/v1/me")
email=$(echo "$me" | python3 -c 'import sys,json; print(json.load(sys.stdin)["email"])')
[[ "$email" == "$EMAIL" ]] || fail "expected email=$EMAIL got $email"
ok "caregiver: $email"

# 5. GET /v1/patients → at least one
step "GET /v1/patients"
patients=$(curl -fsS "${auth[@]}" "$BACKEND_URL/v1/patients")
count=$(echo "$patients" | python3 -c 'import sys,json; print(len(json.load(sys.stdin)))')
[[ "$count" -ge 1 ]] || fail "expected ≥1 patient, got $count"
PATIENT_ID=$(echo "$patients" | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["id"])')
ok "patient_id: $PATIENT_ID"

# 6. cameras + detectors + events for that patient
for res in cameras detectors events; do
  step "GET /v1/patients/$PATIENT_ID/$res"
  body=$(curl -fsS "${auth[@]}" "$BACKEND_URL/v1/patients/$PATIENT_ID/$res")
  if [[ "$res" == "events" ]]; then
    c=$(echo "$body" | python3 -c 'import sys,json; print(len(json.load(sys.stdin)["items"]))')
  else
    c=$(echo "$body" | python3 -c 'import sys,json; print(len(json.load(sys.stdin)))')
  fi
  ok "$res: $c"
done

# 7. POST /v1/livekit/token (viewer)
step "POST /v1/livekit/token (viewer)"
tok=$(curl -sS "${auth[@]}" -X POST "$BACKEND_URL/v1/livekit/token" \
  -H "Content-Type: application/json" \
  -d "{\"room\":\"patient_$PATIENT_ID\",\"identity\":\"caregiver_smoke_test\",\"role\":\"viewer\"}")
lkt=$(echo "$tok" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
[[ -n "$lkt" ]] || fail "no livekit token: $tok"
ok "livekit token minted (${#lkt} chars)"

# 8. POST /v1/patients/.../cameras/pairing-code
step "POST cameras/pairing-code (smoke test camera)"
pair=$(curl -sS "${auth[@]}" -X POST \
  "$BACKEND_URL/v1/patients/$PATIENT_ID/cameras/pairing-code" \
  -H "Content-Type: application/json" \
  -d '{"room":"Smoke test camera","icon_name":"tv"}')
code=$(echo "$pair" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("pairing_code",""))')
cam_id=$(echo "$pair" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("camera_id",""))')
[[ "$code" =~ ^[0-9]{6}$ ]] || fail "expected 6-digit code, got: $pair"
ok "pairing code: $code (camera $cam_id)"

# Clean up the smoke-test camera so re-runs don't pile up rows.
step "DELETE /v1/cameras/$cam_id"
code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  "${auth[@]}" "$BACKEND_URL/v1/cameras/$cam_id")
[[ "$code" == "204" || "$code" == "404" ]] || fail "delete returned $code"
ok "smoke-test camera removed"

printf "\n%sAll smoke tests passed.%s\n" "$CG" "$CR"
