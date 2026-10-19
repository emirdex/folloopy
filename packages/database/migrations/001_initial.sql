CREATE TABLE IF NOT EXISTS workspaces(id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE IF NOT EXISTS entitlements(
 workspace_id uuid PRIMARY KEY REFERENCES workspaces(id), status text NOT NULL CHECK(status IN ('local_test','active','suspended')),
 message_limit integer NOT NULL CHECK(message_limit>=0), used integer NOT NULL DEFAULT 0 CHECK(used>=0)
);
CREATE TABLE IF NOT EXISTS messages(
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), submission_id uuid NOT NULL,
 idempotency_key text NOT NULL, payload_hash text NOT NULL, subject text NOT NULL,
 recipient_count integer NOT NULL CHECK(recipient_count>0), state text NOT NULL CHECK(state IN ('prepared','sending','sent','unknown','failed')),
 provider text NOT NULL, provider_message_id text, provider_thread_id text, rfc_message_id text NOT NULL,
 sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), tracking_enabled boolean NOT NULL DEFAULT true,
 UNIQUE(workspace_id,idempotency_key), UNIQUE(workspace_id,submission_id), UNIQUE(workspace_id,id),
 CHECK((state='sent')=(sent_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS tracking_tokens(
 hash text PRIMARY KEY, workspace_id uuid NOT NULL, message_id uuid NOT NULL, active boolean NOT NULL DEFAULT true,
 FOREIGN KEY(workspace_id,message_id) REFERENCES messages(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS raw_events(
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, message_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind='image_fetch'), occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,message_id) REFERENCES messages(workspace_id,id) ON DELETE CASCADE,
 UNIQUE(workspace_id,id)
);
CREATE INDEX IF NOT EXISTS raw_events_message ON raw_events(workspace_id,message_id,occurred_at);
CREATE TABLE IF NOT EXISTS event_assessments(
 event_id uuid PRIMARY KEY, workspace_id uuid NOT NULL, source text NOT NULL, identity_relation text NOT NULL,
 reason_codes jsonb NOT NULL, classifier_version text NOT NULL,
 FOREIGN KEY(workspace_id,event_id) REFERENCES raw_events(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS outbox(
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, event_id uuid NOT NULL UNIQUE, processed_at timestamptz,
 FOREIGN KEY(workspace_id,event_id) REFERENCES raw_events(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS outbox_pending ON outbox(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS messages_list ON messages(workspace_id,created_at DESC,id);
