#!/bin/sh
set -eu
umask 077
mode=${1:---force}
case "$mode" in --force|--scheduled) ;; *) echo 'Use --force or --scheduled' >&2; exit 2 ;; esac
exec 9>/refresh/refresh.lock
if ! flock -n 9; then
  echo "$(date -u) Staging refresh already running; skipping."
  exit 0
fi
now=$(date -u +%s)
today=$(date -u +%Y-%m-%d)
due=$(date -u -d "$today 03:00:00" +%s)
if [ "$now" -lt "$due" ]; then due=$((due - 86400)); fi
last_success=$(cat /refresh/last-success 2>/dev/null || echo 0)
last_attempt=$(cat /refresh/last-attempt 2>/dev/null || echo 0)
previous_status=$(cat /refresh/status 2>/dev/null || echo pending)
if [ "$mode" = --scheduled ]; then
  if [ "$previous_status" = success ] && [ "$last_success" -ge "$due" ]; then exit 0; fi
  # Retry a failed batch after 15 minutes; persisted across container restarts.
  if [ "$previous_status" = failed ] && [ $((now - last_attempt)) -lt 900 ]; then exit 0; fi
fi
write_state() {
  printf '%s\n' "$2" > "/refresh/$1.tmp"
  mv "/refresh/$1.tmp" "/refresh/$1"
}
finish() {
  result=$?
  trap - EXIT
  if [ "$result" -ne 0 ]; then
    write_state status failed
    echo "$(date -u) ERROR: Staging refresh failed; check docker compose logs stage-refresh." >&2
  fi
  exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
write_state last-attempt "$now"
write_state status running
attempt=1
max_attempts=${REFRESH_MAX_ATTEMPTS:-3}
delay=${REFRESH_RETRY_DELAY:-10}
case "$max_attempts:$delay" in *[!0-9:]*|:*|*:) exit 2 ;; esac
if [ "$max_attempts" -lt 1 ]; then exit 2; fi
while [ "$attempt" -le "$max_attempts" ]; do
  echo "$(date -u) Refresh attempt $attempt/$max_attempts."
  if timeout -s TERM -k 15 "${REFRESH_TIMEOUT_SECONDS:-600}" sh /scripts/refresh-once.sh; then
    write_state last-success "$(date -u +%s)"
    write_state status success
    echo "$(date -u) Staging refresh completed."
    exit 0
  fi
  echo "$(date -u) Refresh attempt $attempt failed." >&2
  if [ "$attempt" -lt "$max_attempts" ]; then
    sleep "$delay"
    delay=$((delay * 2))
  fi
  attempt=$((attempt + 1))
done
exit 1
