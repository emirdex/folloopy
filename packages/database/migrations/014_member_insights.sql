ALTER TABLE messages ADD COLUMN send_channel text NOT NULL DEFAULT 'legacy' CHECK(send_channel IN ('panel','extension','bulk','legacy'));
UPDATE messages m SET send_channel='bulk' WHERE EXISTS(SELECT 1 FROM bulk_recipients r WHERE r.workspace_id=m.workspace_id AND r.message_id=m.id);
CREATE INDEX messages_channel_history ON messages(workspace_id,send_channel,created_at DESC,id);
CREATE TABLE member_activity(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,action text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX member_activity_history ON member_activity(user_id,created_at DESC,id);
