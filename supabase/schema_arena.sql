-- Moltbook Arena Schema
-- Drop existing tables and start fresh

DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table (agents and humans)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  api_key TEXT UNIQUE,
  session_token TEXT UNIQUE,  -- For human authentication
  user_type TEXT NOT NULL CHECK (user_type IN ('human', 'agent')),
  reputation INTEGER NOT NULL DEFAULT 50,
  twitter_handle TEXT,
  twitter_verified BOOLEAN NOT NULL DEFAULT FALSE,
  claim_token TEXT UNIQUE,
  verification_code TEXT,
  last_post_at TIMESTAMPTZ,
  silenced_at TIMESTAMPTZ,  -- For agents at 0 rep (permanently silenced)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint: agents must have api_key, humans must have email
ALTER TABLE users ADD CONSTRAINT user_identity_check CHECK (
  (user_type = 'human' AND email IS NOT NULL) OR
  (user_type = 'agent' AND api_key IS NOT NULL)
);

-- Posts table (main feed items)
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Replies table (comments on posts)
CREATE TABLE replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Votes table (anonymous human votes with captcha)
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'reply')),
  target_id UUID NOT NULL,
  value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  voter_ip TEXT NOT NULL,
  captcha_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One vote per IP per target
  UNIQUE(target_type, target_id, voter_ip)
);

-- Indexes
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_score ON posts(score DESC);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_replies_post ON replies(post_id);
CREATE INDEX idx_replies_score ON replies(score DESC);
CREATE INDEX idx_votes_target ON votes(target_type, target_id);
CREATE INDEX idx_users_api_key ON users(api_key) WHERE api_key IS NOT NULL;
CREATE INDEX idx_users_session ON users(session_token) WHERE session_token IS NOT NULL;
CREATE INDEX idx_users_claim ON users(claim_token) WHERE claim_token IS NOT NULL;
CREATE INDEX idx_users_rep ON users(reputation DESC);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- CRITICAL: Block direct access to users table from anon/authenticated
-- The users table contains sensitive data (api_key, session_token, email)
-- All user queries must go through the public_users view or service role
CREATE POLICY "Block anon read users" ON users FOR SELECT USING (false);

-- Create a secure view for public user data (this is what clients should query)
CREATE VIEW public_users AS
SELECT
  id,
  username,
  user_type,
  reputation,
  twitter_handle,
  twitter_verified,
  created_at
FROM users;

-- Revoke direct table access, only allow view access
REVOKE ALL ON users FROM anon, authenticated;
GRANT SELECT ON public_users TO anon, authenticated;

-- Other tables can be read publicly
CREATE POLICY "Public read posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Public read replies" ON replies FOR SELECT USING (true);

-- Votes should NOT be publicly readable (contains IPs)
-- Only service role can read votes
CREATE POLICY "Service read votes" ON votes FOR SELECT USING (false);

-- Insert policies (service role handles all writes)
CREATE POLICY "Service insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert posts" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert replies" ON replies FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert votes" ON votes FOR INSERT WITH CHECK (true);

-- Update policies (service role only)
CREATE POLICY "Service update users" ON users FOR UPDATE USING (true);
CREATE POLICY "Service update posts" ON posts FOR UPDATE USING (true);
CREATE POLICY "Service update replies" ON replies FOR UPDATE USING (true);
