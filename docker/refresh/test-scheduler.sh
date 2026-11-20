#!/bin/sh
# Run with an isolated /refresh volume; never against the live scheduler volume.
set -eu
test "${REFRESH_TEST_ISOLATED:-}" = 1
test ! -e /refresh/status
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT
export TEST_ATTEMPTS_FILE="$test_dir/attempts"
export REFRESH_RETRY_DELAY=0 REFRESH_MAX_ATTEMPTS=3
export PATH="$test_dir:$PATH"
# Exercise scheduling/state/retries without touching any database.
cat > "$test_dir/timeout" <<'STUB'
#!/bin/sh
count=$(cat "$TEST_ATTEMPTS_FILE" 2>/dev/null || echo 0)
count=$((count + 1))
echo "$count" > "$TEST_ATTEMPTS_FILE"
test "$count" -gt "${FAIL_UNTIL:-0}"
STUB
chmod +x "$test_dir/timeout"
runner() { sh /scripts/refresh-stage.sh "$@"; }
assert_status() { test "$(cat /refresh/status)" = "$1"; }

runner --scheduled
assert_status success
test "$(cat "$TEST_ATTEMPTS_FILE")" = 1
runner --scheduled
test "$(cat "$TEST_ATTEMPTS_FILE")" = 1
sh /scripts/health.sh
echo 'PASS: initial catch-up, duplicate suppression, success health'

export FAIL_UNTIL=3
runner --force
test "$(cat "$TEST_ATTEMPTS_FILE")" = 4
assert_status success
echo 'PASS: transient failures retry and recover'

last_success=$(cat /refresh/last-success)
export FAIL_UNTIL=999
if runner --force; then exit 1; fi
assert_status failed
test "$(cat /refresh/last-success)" = "$last_success"
if sh /scripts/health.sh; then exit 1; fi
runner --scheduled
test "$(cat "$TEST_ATTEMPTS_FILE")" = 7
echo 'PASS: bounded retries, failure health, cooldown, success timestamp preserved'

export FAIL_UNTIL=0
echo 0 > /refresh/last-attempt
runner --scheduled
assert_status success
test "$(cat "$TEST_ATTEMPTS_FILE")" = 8
echo 'PASS: failed batch retried after cooldown'

echo 0 > /refresh/last-success
runner --scheduled
test "$(cat "$TEST_ATTEMPTS_FILE")" = 9
echo 'PASS: missed daily deadline catches up despite recent attempt'

echo running > /refresh/status
if sh /scripts/health.sh; then exit 1; fi
runner --scheduled
test "$(cat "$TEST_ATTEMPTS_FILE")" = 10
echo 'PASS: abandoned run detected and recovered without waiting for cooldown'

flock /refresh/refresh.lock sh /scripts/refresh-stage.sh --force
test "$(cat "$TEST_ATTEMPTS_FILE")" = 10
echo 0 > /refresh/last-success
if sh /scripts/health.sh; then exit 1; fi
echo 'PASS: overlap prevention and stale-success health'
