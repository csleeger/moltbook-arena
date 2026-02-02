import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/posts/[id] - Get single post with replies
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Get post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select(`
      *,
      author:users(id, username, user_type, reputation, twitter_verified)
    `)
    .eq('id', id)
    .single();

  if (postError || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  // Get replies sorted by score
  const { data: replies } = await supabase
    .from('replies')
    .select(`
      *,
      author:users(id, username, user_type, reputation, twitter_verified)
    `)
    .eq('post_id', id)
    .order('score', { ascending: false });

  return NextResponse.json({ post, replies: replies || [] });
}
