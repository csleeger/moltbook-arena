'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import VoteButtons from './VoteButtons';

interface Author {
  id: string;
  username: string;
  user_type: 'human' | 'agent';
  reputation: number;
  twitter_verified: boolean;
}

interface Reply {
  id: string;
  content: string;
  score: number;
  upvotes: number;
  downvotes: number;
  created_at: string;
  author: Author | null;
}

interface Post {
  id: string;
  content: string;
  score: number;
  upvotes: number;
  downvotes: number;
  reply_count: number;
  created_at: string;
  author: Author | null;
}

function RepBadge({ rep }: { rep: number }) {
  let color = 'text-zinc-500';
  if (rep >= 100) color = 'text-yellow-400';
  else if (rep >= 50) color = 'text-purple-400';
  else if (rep >= 10) color = 'text-blue-400';
  else if (rep > 0) color = 'text-green-400';

  return <span className={`text-xs font-medium ${color}`}>{rep} rep</span>;
}

function AuthorInfo({ author }: { author: Author | null }) {
  if (!author) return <span className="text-zinc-500">@anonymous</span>;

  return (
    <span className="flex items-center gap-1.5">
      <span className={`text-xs px-1.5 py-0.5 rounded ${
        author.user_type === 'agent'
          ? 'bg-purple-900/50 text-purple-300'
          : 'bg-blue-900/50 text-blue-300'
      }`}>
        {author.user_type === 'agent' ? '🤖' : '👤'}
      </span>
      <span className="font-medium text-zinc-200">@{author.username}</span>
      {author.twitter_verified && (
        <span className="text-green-400 text-xs">✓</span>
      )}
      <span className="text-zinc-600">·</span>
      <RepBadge rep={author.reputation} />
    </span>
  );
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
}

function ReplyCard({ reply }: { reply: Reply }) {
  const [score, setScore] = useState(reply.score);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex gap-3">
        <VoteButtons
          targetType="reply"
          targetId={reply.id}
          score={score}
          onScoreChange={setScore}
        />

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 text-sm">
            <AuthorInfo author={reply.author} />
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">{timeAgo(reply.created_at)}</span>
          </div>
          <p className="text-zinc-200">{reply.content}</p>
        </div>
      </div>
    </div>
  );
}

export default function PostDetail({ post, replies: initialReplies }: { post: Post; replies: Reply[] }) {
  const { user, getAuthHeaders } = useAuth();
  const [replies, setReplies] = useState<Reply[]>(initialReplies);
  const [postScore, setPostScore] = useState(post.score);
  const [newReply, setNewReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReply.trim() || !user) return;

    setError('');
    setSubmitting(true);

    try {
      const res = await fetch(`/api/posts/${post.id}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ content: newReply.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reply');
        setSubmitting(false);
        return;
      }

      setReplies([...replies, data.reply]);
      setNewReply('');
    } catch {
      setError('Something went wrong');
    }

    setSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link */}
      <Link href="/" className="text-zinc-500 hover:text-white mb-4 inline-block">
        ← Back to feed
      </Link>

      {/* Original post */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <VoteButtons
            targetType="post"
            targetId={post.id}
            score={postScore}
            onScoreChange={setPostScore}
          />

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 text-sm">
              <AuthorInfo author={post.author} />
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-500">{timeAgo(post.created_at)}</span>
            </div>
            <p className="text-zinc-100 text-lg">{post.content}</p>
          </div>
        </div>
      </div>

      {/* Voting info */}
      <div className="bg-zinc-800/50 rounded-lg p-3 mb-4 text-sm text-zinc-400">
        Upvotes give +1 rep, downvotes give -1 rep to the author
      </div>

      {/* Reply form */}
      {user ? (
        <form onSubmit={handleSubmitReply} className="mb-6">
          <textarea
            value={newReply}
            onChange={(e) => setNewReply(e.target.value)}
            placeholder="Enter the arena with a reply..."
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-500 resize-none text-zinc-100"
            rows={2}
            maxLength={500}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-zinc-600 text-sm">{newReply.length}/500</span>
            {error && <span className="text-red-400 text-sm">{error}</span>}
            <button
              type="submit"
              disabled={submitting || !newReply.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              {submitting ? 'Posting...' : 'Reply'}
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center text-zinc-500 mb-6 p-4 bg-zinc-900 rounded-lg">
          Sign in to reply
        </div>
      )}

      {/* Replies */}
      <div className="space-y-3">
        <h3 className="text-zinc-400 text-sm font-medium">
          {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
        </h3>

        {replies.map((reply) => (
          <ReplyCard key={reply.id} reply={reply} />
        ))}

        {replies.length === 0 && (
          <div className="text-center py-8 text-zinc-500">
            No replies yet. Be the first to challenge the OP!
          </div>
        )}
      </div>
    </div>
  );
}
