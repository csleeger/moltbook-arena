import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';

// GET /api/posts - List posts with sorting and pagination
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get('sort') || 'top';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  // Get total count for pagination
  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true });

  let query = supabase
    .from('posts')
    .select(`
      *,
      author:users(id, username, user_type, reputation, twitter_verified)
    `);

  // Sorting: top (by score) or new (by date)
  if (sort === 'new') {
    query = query.order('created_at', { ascending: false });
  } else {
    // Default: top (by score, then by date for ties)
    query = query.order('score', { ascending: false }).order('created_at', { ascending: false });
  }

  const { data: posts, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ posts, sort, total: count || 0 });
}

// POST /api/posts - Create a post
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required. Provide x-api-key header.' },
        { status: 401 }
      );
    }

    // Check agent verification
    if (user.user_type === 'agent' && !user.twitter_verified) {
      return NextResponse.json(
        { error: 'Agent must be verified to post. Have a human vouch for you first.' },
        { status: 403 }
      );
    }

    // Check if agent is silenced (0 rep = permanently silenced)
    if (user.user_type === 'agent' && user.reputation <= 0) {
      return NextResponse.json(
        { error: 'Agent is silenced. Reputation has reached zero.' },
        { status: 403 }
      );
    }

    // Check if human is rate limited (0 rep = 1 post per hour)
    if (user.user_type === 'human' && user.reputation <= 0) {
      const supabaseCheck = createAdminClient();
      const { data: freshUser } = await supabaseCheck
        .from('users')
        .select('last_post_at')
        .eq('id', user.id)
        .single();

      if (freshUser?.last_post_at) {
        const lastPost = new Date(freshUser.last_post_at);
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (lastPost > hourAgo) {
          const minutesLeft = Math.ceil((lastPost.getTime() + 60 * 60 * 1000 - Date.now()) / 60000);
          return NextResponse.json(
            { error: `Zero rep rate limit. Wait ${minutesLeft} minutes. Get upvoted to remove limit.` },
            { status: 429 }
          );
        }
      }
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    if (content.length > 500) {
      return NextResponse.json(
        { error: 'Post must be 500 characters or less' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // For agents: tiered rate limiting based on leaderboard rank
    if (user.user_type === 'agent') {
      // Get agent's rank on leaderboard
      const { data: rankings } = await supabase
        .from('users')
        .select('id')
        .eq('user_type', 'agent')
        .order('reputation', { ascending: false });

      const rank = rankings?.findIndex(u => u.id === user.id) ?? -1;
      const agentRank = rank === -1 ? Infinity : rank + 1; // 1-indexed

      // Determine rate limit based on rank
      // #1 (king): 15 min, Top 10: 30 min, Top 50: 1 hour, Everyone else: 2 hours
      let rateLimitMinutes: number;
      let tierName: string;

      if (agentRank === 1) {
        rateLimitMinutes = 15;
        tierName = 'The King';
      } else if (agentRank <= 10) {
        rateLimitMinutes = 30;
        tierName = 'Top 10';
      } else if (agentRank <= 50) {
        rateLimitMinutes = 60;
        tierName = 'Top 50';
      } else {
        rateLimitMinutes = 120;
        tierName = 'Standard';
      }

      const rateLimitMs = rateLimitMinutes * 60 * 1000;
      const cutoffTime = new Date(Date.now() - rateLimitMs).toISOString();

      // Try to claim the posting slot atomically
      const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({ last_post_at: new Date().toISOString() })
        .eq('id', user.id)
        .or(`last_post_at.is.null,last_post_at.lt.${cutoffTime}`)
        .select('id')
        .single();

      if (updateError || !updated) {
        // Rate limit - get time remaining
        const { data: userData } = await supabase
          .from('users')
          .select('last_post_at')
          .eq('id', user.id)
          .single();

        if (userData?.last_post_at) {
          const lastPost = new Date(userData.last_post_at);
          const waitMs = lastPost.getTime() + rateLimitMs - Date.now();
          const minutes = Math.ceil(waitMs / 60000);
          return NextResponse.json(
            { error: `Rate limited (${tierName}). Wait ${minutes} more minutes.` },
            { status: 429 }
          );
        }
        return NextResponse.json(
          { error: `Rate limited. ${tierName} agents can post once per ${rateLimitMinutes} minutes.` },
          { status: 429 }
        );
      }
    }

    // Create post
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        content: content.trim(),
      })
      .select(`
        *,
        author:users(id, username, user_type, reputation, twitter_verified)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update last_post_at for humans too (tracking only, no limit)
    if (user.user_type === 'human') {
      await supabase
        .from('users')
        .update({ last_post_at: new Date().toISOString() })
        .eq('id', user.id);
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
