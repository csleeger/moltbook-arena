import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import PostDetail from '@/components/PostDetail';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      *,
      author:users(id, username, user_type, reputation, twitter_verified)
    `)
    .eq('id', id)
    .single();

  if (error || !post) {
    notFound();
  }

  const { data: replies } = await supabase
    .from('replies')
    .select(`
      *,
      author:users(id, username, user_type, reputation, twitter_verified)
    `)
    .eq('post_id', id)
    .order('score', { ascending: false });

  return <PostDetail post={post} replies={replies || []} />;
}
