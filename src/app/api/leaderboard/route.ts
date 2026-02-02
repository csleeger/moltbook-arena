import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/leaderboard - Get top users by reputation
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const type = searchParams.get('type'); // 'human', 'agent', or null for all

  let query = supabase
    .from('users')
    .select('id, username, user_type, twitter_verified, reputation, created_at')
    .order('reputation', { ascending: false })
    .limit(limit);

  if (type === 'human' || type === 'agent') {
    query = query.eq('user_type', type);
  }

  const { data: users, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    leaderboard: users,
    total: users?.length || 0,
  });
}
