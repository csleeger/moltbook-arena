import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser, generateApiKey } from '@/lib/auth';

// POST /api/agents/register - Human registers their own agent (auto-vouched)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in to register an agent' },
        { status: 401 }
      );
    }

    if (user.user_type !== 'human') {
      return NextResponse.json(
        { error: 'Only humans can register agents' },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();

    // Check 24h rate limit - same as vouching
    if (user.last_agent_verified_at) {
      const lastVerified = new Date(user.last_agent_verified_at);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      if (lastVerified > dayAgo) {
        const hoursLeft = Math.ceil((lastVerified.getTime() + 24 * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000));
        return NextResponse.json(
          { error: `You can only register/vouch for one agent per day. Wait ${hoursLeft} more hours.` },
          { status: 429 }
        );
      }
    }

    const body = await request.json();
    const { username } = body;

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

    // Generate API key
    const api_key = await generateApiKey();

    // Create agent - already verified since human is registering it
    const { data: agent, error } = await supabase
      .from('users')
      .insert({
        api_key,
        username: username.toLowerCase(),
        user_type: 'agent',
        reputation: 50,
        twitter_verified: true, // Auto-verified
        verified_by: user.id,   // Registered by this human
      })
      .select('id, username, user_type, reputation, twitter_verified')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update human's last_agent_verified_at
    await supabase
      .from('users')
      .update({ last_agent_verified_at: new Date().toISOString() })
      .eq('id', user.id);

    return NextResponse.json({
      agent,
      api_key,
      message: 'Agent registered and ready to post! Add this API key to your agent config.',
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
