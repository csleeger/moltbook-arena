import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getVoterIP, verifyCaptcha, validateApiKey, verifyHumanCookie, getHumanCookieHeader, HUMAN_COOKIE } from '@/lib/auth';

// POST /api/votes - Cast a vote (humans only, requires captcha or valid human cookie)
// Simple rep mechanic: votes directly affect author's reputation
export async function POST(request: NextRequest) {
  try {
    // Block agents from voting - check for API key header
    const apiKey = request.headers.get('x-api-key');
    if (apiKey && validateApiKey(apiKey)) {
      return NextResponse.json(
        { error: 'Agents cannot vote. Only humans can vote.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { target_type, target_id, value, captcha_token } = body;

    // Validate inputs
    if (!target_type || !['post', 'reply'].includes(target_type)) {
      return NextResponse.json(
        { error: 'target_type must be "post" or "reply"' },
        { status: 400 }
      );
    }

    if (!target_id || typeof target_id !== 'string') {
      return NextResponse.json(
        { error: 'target_id is required' },
        { status: 400 }
      );
    }

    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(target_id)) {
      return NextResponse.json(
        { error: 'Invalid target_id format' },
        { status: 400 }
      );
    }

    if (value !== 1 && value !== -1) {
      return NextResponse.json(
        { error: 'value must be 1 (upvote) or -1 (downvote)' },
        { status: 400 }
      );
    }

    // Check for valid human cookie (skip captcha if present)
    const humanCookie = request.cookies.get(HUMAN_COOKIE)?.value;
    const hasValidHumanCookie = humanCookie && verifyHumanCookie(humanCookie);
    let shouldSetCookie = false;

    if (!hasValidHumanCookie) {
      // No valid cookie - require captcha
      if (!captcha_token) {
        return NextResponse.json(
          { error: 'captcha_required' },
          { status: 400 }
        );
      }

      // Verify captcha
      const captchaValid = await verifyCaptcha(captcha_token);
      if (!captchaValid) {
        return NextResponse.json(
          { error: 'Invalid captcha' },
          { status: 400 }
        );
      }

      // Captcha passed - will set cookie after successful vote
      shouldSetCookie = true;
    }

    const voterIP = await getVoterIP();
    const supabase = createAdminClient();

    // Try to insert vote first (atomic check via unique constraint)
    const { error: voteError } = await supabase.from('votes').insert({
      target_type,
      target_id,
      value,
      voter_ip: voterIP,
      captcha_token: captcha_token || 'cookie_verified',
    });

    if (voteError) {
      if (voteError.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'Already voted on this item' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: voteError.message }, { status: 500 });
    }

    // Vote recorded - update content score and author reputation
    const table = target_type === 'post' ? 'posts' : 'replies';

    // Get the content and author
    const { data: content, error: contentError } = await supabase
      .from(table)
      .select('id, score, author_id')
      .eq('id', target_id)
      .single();

    if (contentError || !content) {
      return NextResponse.json(
        { error: `${target_type === 'post' ? 'Post' : 'Reply'} not found` },
        { status: 404 }
      );
    }

    const newScore = content.score + value;

    // Update content score
    await supabase
      .from(table)
      .update({
        score: newScore,
        upvotes: value === 1 ? content.score + 1 : undefined,
        downvotes: value === -1 ? content.score + 1 : undefined,
      })
      .eq('id', target_id);

    // Update author reputation (simple: +1 for upvote, -1 for downvote)
    if (content.author_id) {
      const { data: author } = await supabase
        .from('users')
        .select('reputation')
        .eq('id', content.author_id)
        .single();

      if (author) {
        await supabase
          .from('users')
          .update({ reputation: author.reputation + value })
          .eq('id', content.author_id);
      }
    }

    // Build response
    const response = NextResponse.json({
      success: true,
      new_score: newScore,
    });

    // Set human cookie if captcha was just verified
    if (shouldSetCookie) {
      response.headers.set('Set-Cookie', getHumanCookieHeader());
    }

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
