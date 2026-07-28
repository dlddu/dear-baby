#!/usr/bin/env bash
# Static guard on how the Maestro root flows log in.
#
# Two entry points reach the same tester-login modal:
#   subflows/tester-login.yaml       — the real 15-tap corner gesture
#   subflows/tester-login-fast.yaml  — one press on the E2E-build-only
#                                      `tester-login-fast` hit zone
#
# The fast path exists so the functional flows, which log in as *setup*,
# don't pay ~35-42s of gesture + keystroke replay each. That's only safe
# while login.yaml keeps driving the real gesture, so this script fails if
# a new flow silently picks the fast path as the *only* coverage of the
# gate, or if a flow drops its per-run isolation.
#
# Checks:
#   1. subflows/tester-login.yaml is referenced by exactly one flow, and
#      that flow is login.yaml.
#   2. No flow references both entry points.
#   3. Every flow that logs in still does `clearKeychain` +
#      `launchApp: clearState: true`.
#
# Run from the repo's e2e/ directory: ./scripts/check-login-subflows.sh

set -euo pipefail

cd "$(dirname "$0")/.."

REAL="subflows/tester-login.yaml"
FAST="subflows/tester-login-fast.yaml"
GESTURE_FLOW="maestro/login.yaml"

fail=0
err() {
  echo "::error::$*"
  fail=1
}

# `grep -l` on a fixed "file: <path>" string — the surrounding runFlow
# block is always two lines, so matching the file: line identifies the
# caller without parsing YAML.
callers_of() {
  grep -rl --include="*.yaml" "file: $1" maestro --exclude-dir=subflows | sort
}

real_callers="$(callers_of "$REAL" || true)"
fast_callers="$(callers_of "$FAST" || true)"

real_count="$(printf '%s' "$real_callers" | grep -c . || true)"
fast_count="$(printf '%s' "$fast_callers" | grep -c . || true)"

echo "real-gesture login callers ($real_count):"
printf '%s\n' "${real_callers:-  (none)}"
echo "fast login callers ($fast_count):"
printf '%s\n' "${fast_callers:-  (none)}"

# 1. The real gesture must stay covered, by login.yaml and nothing else.
if [ "$real_count" -ne 1 ] || [ "$real_callers" != "$GESTURE_FLOW" ]; then
  err "expected exactly one flow ($GESTURE_FLOW) to use $REAL, got: ${real_callers:-none}. \
The 15-tap gesture ships in production — one flow must keep asserting it."
fi

# 2. A flow using both would log in twice.
both="$(comm -12 <(printf '%s\n' "$real_callers") <(printf '%s\n' "$fast_callers") | grep -c . || true)"
if [ "$both" -ne 0 ]; then
  err "these flows reference BOTH login subflows: $(comm -12 <(printf '%s\n' "$real_callers") <(printf '%s\n' "$fast_callers") | tr '\n' ' ')"
fi

# 3. Speeding login up must not cost per-flow isolation.
for flow in $real_callers $fast_callers; do
  [ -n "$flow" ] || continue
  grep -q '^- clearKeychain' "$flow" ||
    err "$flow logs in but is missing 'clearKeychain'"
  grep -q 'clearState: true' "$flow" ||
    err "$flow logs in but is missing 'launchApp: clearState: true'"
done

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "OK: $real_count real-gesture caller, $fast_count fast callers, isolation intact."
