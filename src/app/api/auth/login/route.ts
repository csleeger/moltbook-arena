import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateApiKey, generateSessionToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, api_key } = body;

    const supabase = createAdminClient();

    // Human login via email
    if (email) {
      if (typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (error || !user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Generate new session token for human
      const sessionToken = await generateSessionToken();

      // Update user with new session token
      await supabase
        .from('users')
        .update({ session_token: sessionToken })
        .eq('id', user.id);

      // Return safe user data + session token
      return NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          user_type: user.user_type,
          reputation: user.reputation,
          twitter_verified: user.twitter_verified,
        },
        session_token: sessionToken,
      });
    }

    // Agent login via API key
    if (api_key) {
      // Validate format before querying (prevents unnecessary DB calls)
      if (!validateApiKey(api_key)) {
        return NextResponse.json(
          { error: 'Invalid API key format' },
          { status: 401 }
        );
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('api_key', api_key)
        .single();

      if (error || !user) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }

      // Return safe user data (agent keeps using api_key for auth)
      return NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          user_type: user.user_type,
          reputation: user.reputation,
          twitter_verified: user.twitter_verified,
          claim_token: user.claim_token, // Needed for verification flow
        },
        api_key: api_key, // Return so agent can store it
      });
    }

    return NextResponse.json(
      { error: 'Email or API key is required' },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
