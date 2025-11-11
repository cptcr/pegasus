ALTER TABLE warning_automations
ADD COLUMN IF NOT EXISTS notify_channel_id VARCHAR(20);

ALTER TABLE warning_automations
ADD COLUMN IF NOT EXISTS notify_message TEXT;
