-- Add rank card customization and avatar URL fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS rank_card_data TEXT;