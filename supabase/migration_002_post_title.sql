-- Migration: Add title to posts for forum-style threads

ALTER TABLE posts ADD COLUMN IF NOT EXISTS title TEXT;

-- Make title required for new posts (existing posts will have NULL)
-- We'll handle this in the application layer
