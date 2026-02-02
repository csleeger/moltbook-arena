import { createAdminClient } from './supabase/admin';
import { User } from '@/types/database';
import { headers } from 'next/headers';
import crypto from 'crypto';

// Token configuration
const TOKEN_PREFIX = 'arena_';
const CLAIM_PREFIX = 'arena_claim_';
const SESSION_PREFIX = 'session_';
const TOKEN_LENGTH = 32; // bytes

// Word list for verification codes
const ADJECTIVES = [
  'reef', 'wave', 'coral', 'shell', 'tide', 'kelp', 'foam', 'salt',
  'deep', 'blue', 'aqua', 'pearl', 'sand', 'surf', 'cove', 'bay'
];

// Generate API key for agents (moltbook-style prefix)
export async function generateApiKey(): Promise<string> {
  return `${TOKEN_PREFIX}${crypto.randomBytes(TOKEN_LENGTH).toString('hex')}`;
}

// Generate claim token for Twitter verification
export async function generateClaimToken(): Promise<string> {
  return `${CLAIM_PREFIX}${crypto.randomBytes(TOKEN_LENGTH).toString('hex')}`;
}

// Generate human-readable verification code (e.g., "reef-X4B2")
export function generateVerificationCode(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${adjective}-${suffix}`;
}

// Validate API key format
export function validateApiKey(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  if (!token.startsWith(TOKEN_PREFIX)) return false;
  if (token.length !== TOKEN_PREFIX.length + TOKEN_LENGTH * 2) return false;

  const body = token.slice(TOKEN_PREFIX.length);
  return /^[0-9a-f]+$/i.test(body);
}

// Validate claim token format
export function validateClaimToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  if (!token.startsWith(CLAIM_PREFIX)) return false;
  if (token.length !== CLAIM_PREFIX.length + TOKEN_LENGTH * 2) return false;

  const body = token.slice(CLAIM_PREFIX.length);
  return /^[0-9a-f]+$/i.test(body);
}

// Timing-safe token comparison (prevents timing attacks)
export function compareTokens(tokenA: string, tokenB: string): boolean {
  if (!tokenA || !tokenB) return false;

  if (tokenA.length !== tokenB.length) {
    // Still do comparison to maintain constant time
    crypto.timingSafeEqual(Buffer.from(tokenA), Buffer.from(tokenA));
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(tokenA), Buffer.from(tokenB));
}

// Generate session token for humans
export async function generateSessionToken(): Promise<string> {
  return `${SESSION_PREFIX}${crypto.randomBytes(TOKEN_LENGTH).toString('hex')}`;
}

// Validate session token format
export function validateSessionToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  if (!token.startsWith(SESSION_PREFIX)) return false;
  if (token.length !== SESSION_PREFIX.length + TOKEN_LENGTH * 2) return false;

  const body = token.slice(SESSION_PREFIX.length);
  return /^[0-9a-f]+$/i.test(body);
}

// Get current user from API key header (for agents) or session token (for humans)
export async function getCurrentUser(): Promise<User | null> {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const sessionToken = headersList.get('x-session-token');

  if (!apiKey && !sessionToken) return null;

  const supabase = createAdminClient();

  // Agent auth via API key
  if (apiKey) {
    // Validate format before querying (prevents unnecessary DB calls)
    if (!validateApiKey(apiKey)) {
      return null;
    }

    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('api_key', apiKey)
      .single();
    return data as User | null;
  }

  // Human auth via session token
  if (sessionToken) {
    // Validate session token format
    if (!validateSessionToken(sessionToken)) {
      return null;
    }

    // Look up session token in database
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('session_token', sessionToken)
      .single();
    return data as User | null;
  }

  return null;
}

// Get voter IP from headers
export async function getVoterIP(): Promise<string> {
  const headersList = await headers();
  return headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         headersList.get('x-real-ip') ||
         'unknown';
}

// Verify captcha token with Cloudflare Turnstile
export async function verifyCaptcha(token: string): Promise<boolean> {
  // In development/testing, accept demo tokens
  if (process.env.NODE_ENV === 'development' || !process.env.TURNSTILE_SECRET_KEY) {
    // Accept demo token for testing
    if (token === 'demo_token' || token.startsWith('test_')) {
      return true;
    }
  }

  // Production: verify with Cloudflare Turnstile
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.warn('TURNSTILE_SECRET_KEY not set, accepting all tokens');
    return token.length > 0;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Captcha verification failed:', error);
    return false;
  }
}

// Human verification cookie (24h validity)
const HUMAN_COOKIE_NAME = 'arena_human';
const HUMAN_COOKIE_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

// Sign a value with HMAC
function signValue(value: string): string {
  const secret = process.env.COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-secret';
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

// Create a signed human verification cookie value
export function createHumanCookieValue(): string {
  const timestamp = Date.now().toString();
  const signature = signValue(timestamp);
  return `${timestamp}.${signature}`;
}

// Verify a human cookie value
export function verifyHumanCookie(cookieValue: string): boolean {
  if (!cookieValue) return false;

  const parts = cookieValue.split('.');
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;

  // Check signature
  const expectedSignature = signValue(timestamp);
  if (!compareTokens(signature, expectedSignature)) {
    return false;
  }

  // Check expiry (24 hours)
  const cookieTime = parseInt(timestamp, 10);
  if (isNaN(cookieTime)) return false;

  const now = Date.now();
  const maxAge = HUMAN_COOKIE_MAX_AGE * 1000; // convert to ms

  return now - cookieTime < maxAge;
}

// Get cookie header string for setting the human cookie
export function getHumanCookieHeader(): string {
  const value = createHumanCookieValue();
  return `${HUMAN_COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${HUMAN_COOKIE_MAX_AGE}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

// Cookie name export for checking
export const HUMAN_COOKIE = HUMAN_COOKIE_NAME;

// Check if agent can post (rate limit: 1 per hour)
export function canAgentPost(user: User): { allowed: boolean; waitSeconds?: number } {
  if (user.user_type !== 'agent') {
    return { allowed: true };
  }

  if (!user.last_post_at) {
    return { allowed: true };
  }

  const lastPost = new Date(user.last_post_at);
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  if (lastPost < hourAgo) {
    return { allowed: true };
  }

  const waitMs = lastPost.getTime() + 60 * 60 * 1000 - now.getTime();
  return { allowed: false, waitSeconds: Math.ceil(waitMs / 1000) };
}
