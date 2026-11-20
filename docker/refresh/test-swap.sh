#!/bin/sh
# Verify the actual swap SQL against disposable databases on the staging server.
set -eu
export PGUSER=nest PGCONNECT_TIMEOUT=10
prefix="nest_swap_test_$$"
test_dir=$(mktemp -d)
sql() { psql -X -h postgres-stage -d postgres -v ON_ERROR_STOP=1 "$@"; }
cleanup() {
  for suffix in '' _refresh _previous; do
    dropdb -h postgres-stage --if-exists --force "$prefix$suffix"
  done
  rm -rf "$test_dir"
}
trap cleanup EXIT
createdb -h postgres-stage "$prefix"
createdb -h postgres-stage "${prefix}_refresh"
psql -X -h postgres-stage -d "$prefix" -v ON_ERROR_STOP=1 -c 'CREATE TABLE old_marker (id integer);'
psql -X -h postgres-stage -d "${prefix}_refresh" -v ON_ERROR_STOP=1 -c 'CREATE TABLE new_marker (id integer);'
sed "s/nest_stage/$prefix/g" /scripts/swap-stage.sql > "$test_dir/swap.sql"
sed '/COMMIT;/i SELECT 1/0;' "$test_dir/swap.sql" > "$test_dir/fail.sql"
if sql -f "$test_dir/fail.sql"; then exit 1; fi
test "$(psql -X -h postgres-stage -d "$prefix" -Atc "SELECT to_regclass('old_marker') IS NOT NULL")" = t
test "$(psql -X -h postgres-stage -d "${prefix}_refresh" -Atc "SELECT to_regclass('new_marker') IS NOT NULL")" = t
echo 'PASS: failure after both renames rolls back both database names'
sql -f "$test_dir/swap.sql"
test "$(psql -X -h postgres-stage -d "$prefix" -Atc "SELECT to_regclass('new_marker') IS NOT NULL")" = t
test "$(psql -X -h postgres-stage -d "${prefix}_previous" -Atc "SELECT to_regclass('old_marker') IS NOT NULL")" = t
echo 'PASS: successful atomic swap retains previous data'
