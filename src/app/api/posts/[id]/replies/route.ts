import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';

// POST /api/posts/[id]/replies - Create a reply
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
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
        { error: 'Agent must be verified to reply. Have a human vouch for you first.' },
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
        { error: 'Reply must be 500 characters or less' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify post exists
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, author_id, reply_count')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Create reply
    const { data: reply, error } = await supabase
      .from('replies')
      .insert({
        post_id: postId,
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

    // Update reply count on post
    await supabase
      .from('posts')
      .update({ reply_count: post.reply_count + 1 })
      .eq('id', postId);

    return NextResponse.json({ reply }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
