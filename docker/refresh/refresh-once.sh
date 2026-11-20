#!/bin/sh
set -eu
umask 077
# Fixed Docker endpoints keep the job one-way and exclude nest_test.
export PGUSER=nest PGCONNECT_TIMEOUT=10
export PGPASSWORD="${PGPASSWORD:?PGPASSWORD is required}"
export PGOPTIONS='-c lock_timeout=10s -c statement_timeout=300s'
dump=/refresh/production.dump
stage_sql() {
  psql -X --host=postgres-stage --dbname=postgres --set=ON_ERROR_STOP=1 "$@"
}
cleanup() {
  result=$?
  trap - EXIT
  rm -f "$dump"
  if ! stage_sql --command='ALTER DATABASE nest_stage ALLOW_CONNECTIONS true;'; then
    echo 'ERROR: Unable to re-enable staging connections; next attempt will repair them.' >&2
    result=1
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Repair connections after an interrupted cutover before attempting another dump.
stage_sql --command='ALTER DATABASE nest_stage ALLOW_CONNECTIONS true;'
echo "$(date -u) Taking production snapshot."
pg_dump --host=postgres --dbname=nest --format=custom --no-owner --no-acl --file="$dump"
dropdb --host=postgres-stage --if-exists --force nest_stage_refresh
createdb --host=postgres-stage --template=template0 nest_stage_refresh
pg_restore --host=postgres-stage --dbname=nest_stage_refresh \
  --no-owner --no-acl --single-transaction --exit-on-error "$dump"
psql -X --host=postgres-stage --dbname=nest_stage_refresh --set=ON_ERROR_STOP=1 \
  --command='ANALYZE;'
# Retain the prior staging database until the next successful restore.
dropdb --host=postgres-stage --if-exists --force nest_stage_previous
stage_sql --command='ALTER DATABASE nest_stage ALLOW_CONNECTIONS false;'
stage_sql --command="SELECT pg_terminate_backend(pid, 5000) FROM pg_stat_activity WHERE datname = 'nest_stage';"
# Both renames commit together; failure rolls back to the original staging name.
stage_sql --file=/scripts/swap-stage.sql
