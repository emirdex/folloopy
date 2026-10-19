CREATE TABLE users(id uuid PRIMARY KEY, workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id), name text NOT NULL, email text NOT NULL UNIQUE, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE sessions(token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE preview_purchases(workspace_id uuid PRIMARY KEY REFERENCES workspaces(id), plan text NOT NULL CHECK(plan IN ('individual','team','business')), completed_at timestamptz NOT NULL DEFAULT now());
