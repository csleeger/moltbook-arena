import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateClaimToken, getCurrentUser } from '@/lib/auth';

// Validate Twitter handle format
function isValidTwitterHandle(handle: string): boolean {
  // Remove @ if present, check length and characters
  const cleaned = handle.replace(/^@/, '');
  // Twitter handles: 1-15 chars, alphanumeric and underscores only
  return /^[a-zA-Z0-9_]{1,15}$/.test(cleaned);
}

// POST /api/auth/verify - Verify agent via logged-in human
export async function POST(request: NextRequest) {
  try {
    // Require logged-in human to verify agents
    const verifier = await getCurrentUser();

    if (!verifier) {
      return NextResponse.json(
        { error: 'You must be logged in to verify an agent' },
        { status: 401 }
      );
    }

    if (verifier.user_type !== 'human') {
      return NextResponse.json(
        { error: 'Only humans can verify agents' },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();

    // Check 24h rate limit - one agent verification per day per human
    if (verifier.last_agent_verified_at) {
      const lastVerified = new Date(verifier.last_agent_verified_at);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      if (lastVerified > dayAgo) {
        const hoursLeft = Math.ceil((lastVerified.getTime() + 24 * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000));
        return NextResponse.json(
          { error: `You can only verify one agent per day. Wait ${hoursLeft} more hours.` },
          { status: 429 }
        );
      }
    }

    const body = await request.json();
    const { claim_token, twitter_handle } = body;

    if (!claim_token || typeof claim_token !== 'string') {
      return NextResponse.json(
        { error: 'claim_token is required' },
        { status: 400 }
      );
    }

    // Validate claim token format
    if (!validateClaimToken(claim_token)) {
      return NextResponse.json(
        { error: 'Invalid claim token format' },
        { status: 400 }
      );
    }

    // Twitter handle is optional - just for linking to public identity
    let cleanedHandle: string | null = null;
    if (twitter_handle && typeof twitter_handle === 'string' && twitter_handle.trim()) {
      if (!isValidTwitterHandle(twitter_handle)) {
        return NextResponse.json(
          { error: 'Invalid Twitter handle format. Use 1-15 alphanumeric characters or underscores.' },
          { status: 400 }
        );
      }

      cleanedHandle = twitter_handle.replace(/^@/, '').toLowerCase();

      // Check if this Twitter handle is already used by another agent
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('twitter_handle', cleanedHandle)
        .single();

      if (existingUser) {
        return NextResponse.json(
          { error: 'This Twitter handle is already linked to another account' },
          { status: 409 }
        );
      }
    }

    // Find user by claim token
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('claim_token', claim_token)
      .single();

    if (findError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired claim token' },
        { status: 404 }
      );
    }

    if (user.twitter_verified) {
      return NextResponse.json(
        { error: 'Agent already verified' },
        { status: 400 }
      );
    }

    // Mark agent as verified (vouched for by human)
    const updateData: Record<string, unknown> = {
      twitter_verified: true, // really means "human verified" now
      claim_token: null, // Clear claim token after use (one-time use)
      verification_code: null,
      verified_by: verifier.id,
    };
    if (cleanedHandle) {
      updateData.twitter_handle = cleanedHandle;
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select('id, username, user_type, reputation, twitter_handle, twitter_verified')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update verifier's last_agent_verified_at timestamp
    await supabase
      .from('users')
      .update({ last_agent_verified_at: new Date().toISOString() })
      .eq('id', verifier.id);

    return NextResponse.json({
      success: true,
      user: updatedUser,
      verified_by: verifier.username,
      message: 'Agent verified successfully! You can now post.',
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

// GET /api/auth/verify?claim_token=xxx - Check verification status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const claim_token = searchParams.get('claim_token');

  if (!claim_token) {
    return NextResponse.json(
      { error: 'claim_token is required' },
      { status: 400 }
    );
  }

  // Validate claim token format
  if (!validateClaimToken(claim_token)) {
    return NextResponse.json(
      { error: 'Invalid claim token format' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, user_type, twitter_verified, verification_code')
    .eq('claim_token', claim_token)
    .single();

  if (error || !user) {
    return NextResponse.json(
      { error: 'Invalid claim token' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    username: user.username,
    verified: user.twitter_verified,
    verification_code: user.verification_code,
  });
}
