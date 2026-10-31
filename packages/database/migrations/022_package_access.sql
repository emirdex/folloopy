UPDATE messages SET tracking_expires_at=LEAST(COALESCE(tracking_expires_at,created_at+interval '24 hours'),created_at+interval '24 hours'),first_open_only=true WHERE package_plan='free';
UPDATE extension_devices SET revoked=true WHERE NOT EXISTS(SELECT 1 FROM access_grants g JOIN entitlements e ON e.workspace_id=g.workspace_id WHERE g.workspace_id=extension_devices.workspace_id AND g.plan IN ('team','business') AND e.status='active');
UPDATE scheduled_mail SET status='paused',reason='MEMBERSHIP_REQUIRED' WHERE status='queued' AND NOT EXISTS(SELECT 1 FROM access_grants g WHERE g.workspace_id=scheduled_mail.workspace_id AND g.plan IN ('team','business'));
CREATE TABLE bulk_attachments(campaign_id uuid PRIMARY KEY REFERENCES bulk_campaigns(id) ON DELETE CASCADE,payload text NOT NULL);
