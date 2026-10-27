CREATE INDEX tracking_tokens_message ON tracking_tokens(message_id,workspace_id);
CREATE INDEX tracked_links_message ON tracked_links(message_id,workspace_id);
CREATE INDEX bulk_recipients_message ON bulk_recipients(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX member_notifications_message ON member_notifications(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX mail_reminders_message ON mail_reminders(message_id);
CREATE INDEX scheduled_mail_message ON scheduled_mail(message_id) WHERE message_id IS NOT NULL;
