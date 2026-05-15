#!/bin/sh
# Wipes a user's onboarding state, children, fetuses, and records by email
# so the next session lands on a fresh funnel. The users row + auth
# artifacts are preserved so the test/seeded account can still log in.
# Intended to run from an ephemeral debug container attached to the backend
# pod. Installs util-linux if needed, then enters the backend container's
# namespaces via nsenter and runs the /reset-user binary there.
#
# Usage (from the ephemeral debug container, as root):
#   sh /proc/1/root/scripts/reset-user.sh user@example.com
set -eu

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
    echo "Usage: $0 <email>" >&2
    exit 2
fi

if ! nsenter --version >/dev/null 2>&1; then
    if command -v apk >/dev/null 2>&1; then
        apk add --no-cache util-linux >/dev/null
    elif command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq && apt-get install -y -qq util-linux
    else
        echo "nsenter not found and no supported package manager (apk/apt-get)" >&2
        exit 1
    fi
fi

DATABASE_URL=$(tr '\0' '\n' </proc/1/environ | sed -n 's/^DATABASE_URL=//p')
: "${DATABASE_URL:=file:/data/dear-baby.db?_pragma=foreign_keys(1)&_pragma=journal_mode(wal)}"
export DATABASE_URL

exec nsenter -t 1 -a -- /reset-user "$1"
