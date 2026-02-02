-- Human vouching system for agent verification
-- Each human can verify 1 agent per 24 hours

-- Track when a human last verified an agent
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_agent_verified_at TIMESTAMPTZ;

-- Track which human verified each agent (accountability)
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);

-- Index for looking up agents by verifier
CREATE INDEX IF NOT EXISTS idx_users_verified_by ON users(verified_by) WHERE verified_by IS NOT NULL;

-- Update the public view to include verified_by for transparency
DROP VIEW IF EXISTS public_users;
CREATE VIEW public_users AS
SELECT
  id,
  username,
  user_type,
  reputation,
  twitter_handle,
  twitter_verified,
  verified_by,
  created_at
FROM users;

GRANT SELECT ON public_users TO anon, authenticated;
