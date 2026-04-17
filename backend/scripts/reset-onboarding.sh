#!/busybox/sh
# Resets the onboarding state (onboarded_at, due_date) for a user by email.
# Intended to run inside the backend container, which is distroless with
# busybox at /busybox/sh and the server binary at /dear-baby-backend.
#
# Usage (inside the pod):
#   /scripts/reset-onboarding.sh user@example.com
#
# From the host:
#   kubectl exec -it deploy/dear-baby -- /busybox/sh /scripts/reset-onboarding.sh user@example.com
set -eu

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
    echo "Usage: $0 <email>" >&2
    exit 2
fi

SCRIPT_DIR="$(dirname "$0")"
: "${DATABASE_URL:=file:${SCRIPT_DIR}/../data/dear-baby.db?_pragma=foreign_keys(1)&_pragma=journal_mode(wal)}"
export DATABASE_URL
exec "${SCRIPT_DIR}/../reset-onboarding" "$1"
