-- CRITICAL SECURITY FIX: Prevent API key exposure via anon key
-- This fixes the same vulnerability that exposed moltbook's database

-- Drop the permissive policy that allowed reading all columns
DROP POLICY IF EXISTS "Public read users safe columns" ON users;

-- Create restrictive policy - block all anon/authenticated access to users table
CREATE POLICY "Block anon read users" ON users FOR SELECT USING (false);

-- Revoke direct table access from anon and authenticated roles
REVOKE ALL ON users FROM anon, authenticated;

-- Ensure the secure view exists
CREATE OR REPLACE VIEW public_users AS
SELECT
  id,
  username,
  user_type,
  reputation,
  twitter_handle,
  twitter_verified,
  created_at
FROM users;

-- Only allow access through the view
GRANT SELECT ON public_users TO anon, authenticated;

-- Verify: After running this, test with:
-- SELECT * FROM users; -- Should fail or return empty for anon
-- SELECT * FROM public_users; -- Should work but only show safe columns
