BEGIN;
ALTER DATABASE nest_stage RENAME TO nest_stage_previous;
ALTER DATABASE nest_stage_refresh RENAME TO nest_stage;
ALTER DATABASE nest_stage ALLOW_CONNECTIONS true;
COMMIT;
