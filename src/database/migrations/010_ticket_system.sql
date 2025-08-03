-- Create ticket panels table
CREATE TABLE IF NOT EXISTS ticket_panels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    panel_id VARCHAR(20) NOT NULL UNIQUE,
    title VARCHAR(256) NOT NULL,
    description TEXT NOT NULL,
    image_url VARCHAR(512),
    footer VARCHAR(256),
    button_label VARCHAR(80) NOT NULL DEFAULT 'Create Ticket',
    button_style INTEGER NOT NULL DEFAULT 1,
    support_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    category_id VARCHAR(20),
    ticket_name_format VARCHAR(100) NOT NULL DEFAULT 'ticket-{number}',
    max_tickets_per_user INTEGER NOT NULL DEFAULT 1,
    welcome_message TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    message_id VARCHAR(20),
    channel_id VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add panel_id to tickets table if not exists
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS panel_id UUID REFERENCES ticket_panels(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_number INTEGER;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_reason TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS locked_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS frozen_by VARCHAR(20) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP;

-- Update status column to support new statuses
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('open', 'claimed', 'closed', 'locked', 'frozen'));

-- Update ticket_messages attachments to JSONB if not already
ALTER TABLE ticket_messages 
ALTER COLUMN attachments TYPE JSONB USING COALESCE(attachments::jsonb, '[]'::jsonb),
ALTER COLUMN attachments SET DEFAULT '[]'::jsonb,
ALTER COLUMN attachments SET NOT NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ticket_panels_guild_id ON ticket_panels(guild_id);
CREATE INDEX IF NOT EXISTS idx_ticket_panels_panel_id ON ticket_panels(panel_id);
CREATE INDEX IF NOT EXISTS idx_tickets_panel_id ON tickets(panel_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for ticket_panels
DROP TRIGGER IF EXISTS update_ticket_panels_updated_at ON ticket_panels;
CREATE TRIGGER update_ticket_panels_updated_at BEFORE UPDATE ON ticket_panels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for tickets
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();