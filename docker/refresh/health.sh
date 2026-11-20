#!/bin/sh
set -eu
status=$(cat /refresh/status 2>/dev/null || echo pending)
last_success=$(cat /refresh/last-success 2>/dev/null || echo 0)
last_attempt=$(cat /refresh/last-attempt 2>/dev/null || echo 0)
now=$(date -u +%s)
if [ "$status" = running ]; then
  if flock -n /refresh/refresh.lock true; then exit 1; fi
  # A crashed job cannot remain healthy indefinitely.
  test $((now - last_attempt)) -lt 3600
else
  test "$status" = success && test $((now - last_success)) -lt 93600
fi
