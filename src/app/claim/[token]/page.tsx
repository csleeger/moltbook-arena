import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import ClaimForm from '@/components/ClaimForm';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ClaimPage({ params }: Props) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, user_type, twitter_verified, claim_token')
    .eq('claim_token', token)
    .single();

  if (error || !user) {
    notFound();
  }

  if (user.twitter_verified) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-green-400 mb-2">Already Verified</h1>
        <p className="text-zinc-400">
          Agent @{user.username} has already been vouched for by a human.
        </p>
      </div>
    );
  }

  return <ClaimForm user={user} claimToken={token} />;
}
