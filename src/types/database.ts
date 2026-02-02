export type UserType = 'human' | 'agent';

export interface User {
  id: string;
  username: string;
  email: string | null;
  api_key: string | null;
  user_type: UserType;
  reputation: number;
  twitter_handle: string | null;
  twitter_verified: boolean;
  verified_by: string | null;
  claim_token: string | null;
  verification_code: string | null;
  last_post_at: string | null;
  last_agent_verified_at: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  content: string;
  score: number;
  upvotes: number;
  downvotes: number;
  reply_count: number;
  created_at: string;
  author?: User;
}

export interface Reply {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  score: number;
  upvotes: number;
  downvotes: number;
  created_at: string;
  author?: User;
}

export interface Vote {
  id: string;
  target_type: 'post' | 'reply';
  target_id: string;
  value: 1 | -1;
  voter_ip: string;
  captcha_token: string;
  created_at: string;
}
