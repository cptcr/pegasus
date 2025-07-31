-- UP
-- Comprehensive ticket system tables

-- Ticket categories for organization
CREATE TABLE IF NOT EXISTS ticket_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id VARCHAR(20) NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  emoji VARCHAR(10),
  color VARCHAR(7) DEFAULT '#3498db',
  channel_id VARCHAR(20), -- Category channel for organization
  support_roles VARCHAR(20)[] DEFAULT '{}',
  auto_close_hours INTEGER DEFAULT 72,
  require_reason BOOLEAN DEFAULT true,
  max_tickets_per_user INTEGER DEFAULT 3,
  priority_levels VARCHAR(20)[] DEFAULT '{"low","medium","high","urgent"}',
  custom_fields JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced ticket panels with multiple button support
CREATE TABLE IF NOT EXISTS ticket_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(20) NOT NULL,
  message_id VARCHAR(20),
  title VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3498db',
  embed_thumbnail VARCHAR(500),
  embed_image VARCHAR(500),
  buttons JSONB DEFAULT '[]', -- Array of button configurations
  category_mapping JSONB DEFAULT '{}', -- Map button IDs to category IDs
  support_roles VARCHAR(20)[] DEFAULT '{}',
  ping_roles VARCHAR(20)[] DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_by VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comprehensive tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(20) NOT NULL,
  thread_id VARCHAR(20), -- For thread-based tickets
  panel_id UUID REFERENCES ticket_panels(id) ON DELETE SET NULL,
  category_id UUID REFERENCES ticket_categories(id) ON DELETE SET NULL,
  subject VARCHAR(200) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'open',
  assigned_to VARCHAR(20),
  claimed_at TIMESTAMP,
  custom_fields JSONB DEFAULT '{}',
  tags VARCHAR(50)[] DEFAULT '{}',
  
  -- Timing and SLA tracking
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  first_response_at TIMESTAMP,
  last_response_at TIMESTAMP,
  closed_at TIMESTAMP,
  closed_by VARCHAR(20),
  close_reason TEXT,
  
  -- Analytics
  response_time_minutes INTEGER,
  resolution_time_minutes INTEGER,
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  satisfaction_feedback TEXT,
  
  -- Auto-close settings
  auto_close_warning_sent BOOLEAN DEFAULT false,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket participants (for adding/removing users)
CREATE TABLE IF NOT EXISTS ticket_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  user_id VARCHAR(20) NOT NULL,
  added_by VARCHAR(20) NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMP,
  removed_by VARCHAR(20),
  UNIQUE(ticket_id, user_id)
);

-- Ticket activity log for full audit trail
CREATE TABLE IF NOT EXISTS ticket_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  user_id VARCHAR(20) NOT NULL,
  action VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}',
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket transcripts storage
CREATE TABLE IF NOT EXISTS ticket_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  guild_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(20) NOT NULL,
  generated_by VARCHAR(20) NOT NULL,
  html_content TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  attachment_count INTEGER DEFAULT 0,
  file_path VARCHAR(500), -- Path to saved HTML file
  archive_channel_id VARCHAR(20), -- Channel where transcript was posted
  archive_message_id VARCHAR(20), -- Message ID of the archived transcript
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket statistics for analytics
CREATE TABLE IF NOT EXISTS ticket_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id VARCHAR(20) NOT NULL,
  date DATE NOT NULL,
  
  -- Daily metrics
  tickets_created INTEGER DEFAULT 0,
  tickets_closed INTEGER DEFAULT 0,
  tickets_claimed INTEGER DEFAULT 0,
  
  -- Response time metrics (in minutes)
  avg_first_response_time DECIMAL(10,2),
  avg_resolution_time DECIMAL(10,2),
  
  -- Staff performance
  staff_responses JSONB DEFAULT '{}', -- staff_id -> response_count
  category_distribution JSONB DEFAULT '{}', -- category_id -> ticket_count
  priority_distribution JSONB DEFAULT '{}', -- priority -> ticket_count
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, date)
);

-- Ticket settings per guild
CREATE TABLE IF NOT EXISTS ticket_settings (
  guild_id VARCHAR(20) PRIMARY KEY,
  
  -- General settings
  enabled BOOLEAN DEFAULT true,
  max_tickets_per_user INTEGER DEFAULT 5,
  max_open_time_hours INTEGER DEFAULT 168, -- 7 days
  
  -- Auto-close settings
  auto_close_enabled BOOLEAN DEFAULT true,
  auto_close_time_hours INTEGER DEFAULT 72,
  auto_close_warning_hours INTEGER DEFAULT 48,
  
  -- Transcript settings
  transcript_channel_id VARCHAR(20),
  auto_transcript BOOLEAN DEFAULT true,
  
  -- Permission settings
  support_roles VARCHAR(20)[] DEFAULT '{}',
  admin_roles VARCHAR(20)[] DEFAULT '{}',
  ping_roles VARCHAR(20)[] DEFAULT '{}',
  
  -- Rate limiting
  rate_limit_enabled BOOLEAN DEFAULT true,
  rate_limit_count INTEGER DEFAULT 3,
  rate_limit_window_minutes INTEGER DEFAULT 60,
  
  -- Logging
  log_channel_id VARCHAR(20),
  log_events VARCHAR(50)[] DEFAULT '{"created","claimed","closed","priority_changed"}',
  
  -- Custom messages
  welcome_message TEXT DEFAULT 'Thank you for creating a ticket! Our support team will be with you shortly.',
  close_message TEXT DEFAULT 'This ticket has been closed. If you need further assistance, please create a new ticket.',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS ticket_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'create', 'message', etc.
  count INTEGER DEFAULT 1,
  window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(guild_id, user_id, action)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_guild_status ON tickets(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_last_activity ON tickets(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category_id);

CREATE INDEX IF NOT EXISTS idx_ticket_panels_guild ON ticket_panels(guild_id);
CREATE INDEX IF NOT EXISTS idx_ticket_panels_enabled ON ticket_panels(enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_ticket_categories_guild ON ticket_categories(guild_id);

CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket ON ticket_activities(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_user ON ticket_activities(user_id);

CREATE INDEX IF NOT EXISTS idx_ticket_participants_ticket ON ticket_participants(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_participants_user ON ticket_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_ticket_transcripts_ticket ON ticket_transcripts(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_transcripts_guild ON ticket_transcripts(guild_id);

CREATE INDEX IF NOT EXISTS idx_ticket_stats_guild_date ON ticket_stats(guild_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_rate_limits_user ON ticket_rate_limits(guild_id, user_id, action);
CREATE INDEX IF NOT EXISTS idx_ticket_rate_limits_expires ON ticket_rate_limits(expires_at);

-- Create trigger functions for updating timestamps
CREATE OR REPLACE FUNCTION update_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_ticket_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_activity_at when certain fields change
  IF TG_OP = 'UPDATE' AND (
    OLD.status != NEW.status OR 
    OLD.assigned_to != NEW.assigned_to OR 
    OLD.priority != NEW.priority
  ) THEN
    NEW.last_activity_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_ticket_updated_at();

CREATE TRIGGER trigger_tickets_last_activity
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_ticket_last_activity();

CREATE TRIGGER trigger_ticket_panels_updated_at
  BEFORE UPDATE ON ticket_panels
  FOR EACH ROW EXECUTE FUNCTION update_ticket_updated_at();

CREATE TRIGGER trigger_ticket_categories_updated_at
  BEFORE UPDATE ON ticket_categories
  FOR EACH ROW EXECUTE FUNCTION update_ticket_updated_at();

-- Insert default ticket categories for new guilds
CREATE OR REPLACE FUNCTION create_default_ticket_categories(p_guild_id VARCHAR(20))
RETURNS VOID AS $$
BEGIN
  -- General Support
  INSERT INTO ticket_categories (guild_id, name, description, emoji, color, priority_levels)
  VALUES (
    p_guild_id,
    'General Support',
    'General questions and assistance',
    '❓',
    '#3498db',
    '{"low","medium","high","urgent"}'
  );
  
  -- Bug Reports
  INSERT INTO ticket_categories (guild_id, name, description, emoji, color, priority_levels)
  VALUES (
    p_guild_id,
    'Bug Report',
    'Report bugs and technical issues',
    '🐛',
    '#e74c3c',
    '{"medium","high","urgent"}'
  );
  
  -- Appeals
  INSERT INTO ticket_categories (guild_id, name, description, emoji, color, priority_levels)
  VALUES (
    p_guild_id,
    'Appeals',
    'Appeal moderation actions',
    '⚖️',
    '#f39c12',
    '{"medium","high"}'
  );
  
  -- Feedback
  INSERT INTO ticket_categories (guild_id, name, description, emoji, color, priority_levels)
  VALUES (
    p_guild_id,
    'Feedback',
    'Provide feedback and suggestions',
    '💭',
    '#9b59b6',
    '{"low","medium"}'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to automatically clean up expired rate limits
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS VOID AS $$
BEGIN
  DELETE FROM ticket_rate_limits WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- DOWN
-- Drop triggers
DROP TRIGGER IF EXISTS trigger_ticket_categories_updated_at ON ticket_categories;
DROP TRIGGER IF EXISTS trigger_ticket_panels_updated_at ON ticket_panels;
DROP TRIGGER IF EXISTS trigger_tickets_last_activity ON tickets;
DROP TRIGGER IF EXISTS trigger_tickets_updated_at ON tickets;

-- Drop functions
DROP FUNCTION IF EXISTS cleanup_expired_rate_limits();
DROP FUNCTION IF EXISTS create_default_ticket_categories(VARCHAR(20));
DROP FUNCTION IF EXISTS update_ticket_last_activity();
DROP FUNCTION IF EXISTS update_ticket_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_ticket_rate_limits_expires;
DROP INDEX IF EXISTS idx_ticket_rate_limits_user;
DROP INDEX IF EXISTS idx_ticket_stats_guild_date;
DROP INDEX IF EXISTS idx_ticket_transcripts_guild;
DROP INDEX IF EXISTS idx_ticket_transcripts_ticket;
DROP INDEX IF EXISTS idx_ticket_participants_user;
DROP INDEX IF EXISTS idx_ticket_participants_ticket;
DROP INDEX IF EXISTS idx_ticket_activities_user;
DROP INDEX IF EXISTS idx_ticket_activities_ticket;
DROP INDEX IF EXISTS idx_ticket_categories_guild;
DROP INDEX IF EXISTS idx_ticket_panels_enabled;
DROP INDEX IF EXISTS idx_ticket_panels_guild;
DROP INDEX IF EXISTS idx_tickets_category;
DROP INDEX IF EXISTS idx_tickets_priority;
DROP INDEX IF EXISTS idx_tickets_last_activity;
DROP INDEX IF EXISTS idx_tickets_created_at;
DROP INDEX IF EXISTS idx_tickets_assigned;
DROP INDEX IF EXISTS idx_tickets_user_status;
DROP INDEX IF EXISTS idx_tickets_guild_status;

-- Drop tables in reverse order
DROP TABLE IF EXISTS ticket_rate_limits;
DROP TABLE IF EXISTS ticket_settings;
DROP TABLE IF EXISTS ticket_stats;
DROP TABLE IF EXISTS ticket_transcripts;
DROP TABLE IF EXISTS ticket_activities;
DROP TABLE IF EXISTS ticket_participants;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS ticket_panels;
DROP TABLE IF EXISTS ticket_categories;