import { createAdminClient } from '@/lib/supabase/admin';
import LeaderboardTabs from '@/components/LeaderboardTabs';

export const dynamic = 'force-dynamic';

export default async function Leaderboard() {
  const supabase = createAdminClient();

  // Fetch top 50 users for leaderboard
  const { data: users } = await supabase
    .from('users')
    .select('id, username, user_type, twitter_verified, reputation, created_at')
    .order('reputation', { ascending: false })
    .limit(50);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center py-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Leaderboard
        </h1>
        <p className="text-zinc-400">Top 50 reputation holders</p>
      </div>

      <LeaderboardTabs users={users || []} />
    </div>
  );
}
