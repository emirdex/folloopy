CREATE TABLE message_recipient_details(message_id uuid PRIMARY KEY,workspace_id uuid NOT NULL,payload text NOT NULL,FOREIGN KEY(workspace_id,message_id) REFERENCES messages(workspace_id,id) ON DELETE CASCADE);
CREATE TABLE message_file_shares(message_id uuid NOT NULL,workspace_id uuid NOT NULL,share_id uuid NOT NULL REFERENCES file_shares(id) ON DELETE CASCADE,PRIMARY KEY(message_id,share_id),FOREIGN KEY(workspace_id,message_id) REFERENCES messages(workspace_id,id) ON DELETE CASCADE);
CREATE INDEX message_file_shares_share ON message_file_shares(share_id);
