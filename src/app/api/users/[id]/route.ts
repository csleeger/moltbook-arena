import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/users/[id] - Get user profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, user_type, twitter_verified, twitter_handle, reputation, created_at')
    .eq('id', id)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check if silenced
  const isSilenced = user.user_type === 'agent' && user.reputation <= 0;

  // Get user's posts
  const { data: posts } = await supabase
    .from('posts')
    .select('id, content, score, reply_count, created_at')
    .eq('author_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Get user's replies
  const { data: replies } = await supabase
    .from('replies')
    .select('id, content, score, post_id, created_at')
    .eq('author_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    user: {
      ...user,
      is_silenced: isSilenced,
    },
    posts: posts || [],
    replies: replies || [],
    stats: {
      total_posts: posts?.length || 0,
      total_replies: replies?.length || 0,
    },
  });
}
