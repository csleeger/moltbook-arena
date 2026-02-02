import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateApiKey, generateClaimToken, generateSessionToken, verifyCaptcha, getHumanCookieHeader, getVoterIP } from '@/lib/auth';

// Simple in-memory rate limiter for signups
// In production, use Redis or database
const signupAttempts = new Map<string, { count: number; resetAt: number }>();
const SIGNUP_LIMIT = 5; // max signups per IP
const SIGNUP_WINDOW = 60 * 60 * 1000; // 1 hour

function checkSignupRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = signupAttempts.get(ip);

  if (!record || now > record.resetAt) {
    signupAttempts.set(ip, { count: 1, resetAt: now + SIGNUP_WINDOW });
    return { allowed: true };
  }

  if (record.count >= SIGNUP_LIMIT) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000 / 60);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
}

export async function POST(request: NextRequest) {
  try {
    // IP rate limiting
    const ip = await getVoterIP();
    const rateLimit = checkSignupRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Too many signups. Try again in ${rateLimit.retryAfter} minutes.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, username, user_type, captcha_token } = body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check if username exists
    const { data: existingUsername } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase())
      .single();

    if (existingUsername) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 409 }
      );
    }

    if (user_type === 'human') {
      if (!email) {
        return NextResponse.json(
          { error: 'Email is required for human users' },
          { status: 400 }
        );
      }

      // Require captcha for human signup
      if (!captcha_token) {
        return NextResponse.json(
          { error: 'Captcha is required for human signup' },
          { status: 400 }
        );
      }

      const captchaValid = await verifyCaptcha(captcha_token);
      if (!captchaValid) {
        return NextResponse.json(
          { error: 'Invalid captcha' },
          { status: 400 }
        );
      }

      const { data: existingEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 409 }
        );
      }

      // Generate session token for human
      const sessionToken = await generateSessionToken();

      const { data: user, error } = await supabase
        .from('users')
        .insert({
          email,
          username: username.toLowerCase(),
          user_type: 'human',
          reputation: 50, // Everyone starts at 50
          session_token: sessionToken,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Return safe user data + session token, set human cookie
      const response = NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          user_type: user.user_type,
          reputation: user.reputation,
          twitter_verified: user.twitter_verified,
        },
        session_token: sessionToken,
      });

      // Set human verification cookie (24h)
      response.headers.set('Set-Cookie', getHumanCookieHeader());

      return response;
    }

    if (user_type === 'agent') {
      // Generate credentials for human vouching flow
      const api_key = await generateApiKey();
      const claim_token = await generateClaimToken();

      const { data: user, error } = await supabase
        .from('users')
        .insert({
          api_key,
          username: username.toLowerCase(),
          user_type: 'agent',
          reputation: 50, // Agents start at 50 rep
          claim_token,
          twitter_verified: false,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Return credentials for verification flow
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const claim_url = `${baseUrl}/claim/${claim_token}`;

      return NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          user_type: user.user_type,
          reputation: user.reputation,
          twitter_verified: user.twitter_verified,
          claim_token: claim_token,
        },
        api_key,
        claim_url,
        instructions: `To activate your agent, have a human visit ${claim_url} and vouch for it. Humans can vouch for 1 agent per day.`,
      });
    }

    return NextResponse.json(
      { error: 'Invalid user_type. Must be "human" or "agent"' },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
