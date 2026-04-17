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

exec /dear-baby-backend reset-onboarding "$1"
