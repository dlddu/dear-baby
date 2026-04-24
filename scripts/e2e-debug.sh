#!/usr/bin/env bash
# Local reproducer for the AI-preview pipeline.
# Spins up Redis + backend + worker from source, creates a test user,
# saves a record, triggers an AI-preview request, and tails the logs
# until the preview arrives (or a timeout).
#
# Usage:
#   OPENROUTER_API_KEY=sk-or-... ./scripts/e2e-debug.sh
#   OPENROUTER_API_KEY=sk-or-... OPENROUTER_MODEL=openrouter/free ./scripts/e2e-debug.sh
#
# Uses host-native processes (no docker) so breakpoints, log tailing, and
# fast restarts work out of the box. Requires: go, node 20+, redis-server.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="$ROOT/tmp/e2e-debug"
mkdir -p "$LOGDIR"

: "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY must be set}"
: "${OPENROUTER_MODEL:=openrouter/free}"

cleanup() {
  rc=$?
  echo
  echo "=== cleanup ==="
  for f in "$LOGDIR"/*.pid; do
    [ -f "$f" ] || continue
    pid=$(cat "$f")
    kill "$pid" 2>/dev/null || true
  done
  # Summary tails so you can inspect without leaving the terminal.
  for name in backend worker redis; do
    if [ -f "$LOGDIR/$name.log" ]; then
      echo
      echo "--- $name.log (last 40) ---"
      tail -n 40 "$LOGDIR/$name.log" || true
    fi
  done
  exit $rc
}
trap cleanup EXIT INT TERM

echo "=== 1/5: redis ==="
if ! command -v redis-server >/dev/null 2>&1; then
  echo "redis-server not found — install with 'brew install redis' or apt-get install redis-server"
  exit 1
fi
# Match the k8s config: no persistence.
nohup redis-server --port 6379 --appendonly no --save "" >"$LOGDIR/redis.log" 2>&1 &
echo $! >"$LOGDIR/redis.pid"
sleep 1
if ! redis-cli ping >/dev/null 2>&1; then
  echo "redis failed to start, see $LOGDIR/redis.log"; exit 1
fi
echo "  redis ready on :6379"

echo "=== 2/5: backend ==="
(
  cd "$ROOT/backend"
  go build -o /tmp/dear-baby-debug ./cmd/server
  TEST_AUTH_ENABLED=true \
  REDIS_URL=redis://localhost:6379 \
  DATABASE_URL="file:$LOGDIR/dear-baby.db?_pragma=foreign_keys(1)" \
  PORT=8080 \
  nohup /tmp/dear-baby-debug >"$LOGDIR/backend.log" 2>&1 &
  echo $! >"$LOGDIR/backend.pid"
)
for i in $(seq 1 30); do
  if curl -fsS http://localhost:8080/health >/dev/null 2>&1; then
    echo "  backend ready on :8080"
    break
  fi
  sleep 1
done

echo "=== 3/5: worker ==="
(
  cd "$ROOT/worker"
  if [ ! -d node_modules ]; then npm install --no-audit --no-fund; fi
  npm run build >/dev/null
  REDIS_URL=redis://localhost:6379 \
  OPENROUTER_API_KEY="$OPENROUTER_API_KEY" \
  OPENROUTER_MODEL="$OPENROUTER_MODEL" \
  LOG_LEVEL=debug \
  nohup node dist/index.js >"$LOGDIR/worker.log" 2>&1 &
  echo $! >"$LOGDIR/worker.pid"
)
sleep 2
if ! kill -0 "$(cat "$LOGDIR/worker.pid")"; then
  echo "  worker died on startup, log:"
  cat "$LOGDIR/worker.log"
  exit 1
fi
echo "  worker started (pid=$(cat "$LOGDIR/worker.pid"))"

echo "=== 4/5: seed user + record + request preview ==="
email="debug-$(date +%s)@dear-baby.test"
session=$(curl -fsS -X POST \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$email\",\"onboarded\":true}" \
  http://localhost:8080/auth/test-login)
access_token=$(echo "$session" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
user_id=$(echo "$session" | python3 -c 'import json,sys; print(json.load(sys.stdin)["user"]["id"])')
echo "  user_id=$user_id"

curl -fsS -X POST \
  -H "Authorization: Bearer $access_token" \
  -H 'Content-Type: application/json' \
  -d '{"content":"today i felt you move for the first time"}' \
  http://localhost:8080/records >/dev/null
echo "  record saved"

code=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST \
  -H "Authorization: Bearer $access_token" \
  http://localhost:8080/onboarding/ai-preview)
if [ "$code" != "202" ]; then
  echo "  /onboarding/ai-preview returned $code, aborting"; exit 1
fi
echo "  AI preview enqueued (202)"

echo "=== 5/5: wait for /me.ai_preview (up to 60s) ==="
preview=""
for i in $(seq 1 60); do
  preview=$(curl -fsS \
    -H "Authorization: Bearer $access_token" \
    http://localhost:8080/me \
    | python3 -c 'import json,sys; v=json.load(sys.stdin).get("ai_preview") or ""; print(v)')
  if [ -n "$preview" ]; then
    break
  fi
  sleep 1
done

if [ -z "$preview" ]; then
  echo "  PREVIEW DID NOT ARRIVE — dumping logs"
  exit 1
fi

echo
echo "✓ preview received:"
echo "---"
echo "$preview"
echo "---"
