-- Add preferred locale to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferred_locale VARCHAR(5) DEFAULT 'en';