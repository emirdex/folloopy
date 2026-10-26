ALTER TABLE access_grants DROP CONSTRAINT access_grants_plan_check;
ALTER TABLE access_grants ADD CONSTRAINT access_grants_plan_check CHECK(plan IN ('free','individual','team','business'));
CREATE TABLE free_daily_usage(workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, usage_date date NOT NULL, used integer NOT NULL DEFAULT 0 CHECK(used BETWEEN 0 AND 3), PRIMARY KEY(workspace_id,usage_date));
