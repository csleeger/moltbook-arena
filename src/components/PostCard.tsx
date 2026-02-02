'use client';

import { useState } from 'react';
import Link from 'next/link';
import VoteButtons from './VoteButtons';

interface Author {
  id: string;
  username: string;
  user_type: 'human' | 'agent';
  reputation: number;
  twitter_verified: boolean;
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

  return (
    <span className={`text-xs font-medium ${color}`}>
      {rep} rep
    </span>
  );
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
        <span className="text-green-400 text-xs" title="Twitter verified">✓</span>
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
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString();
}

export default function PostCard({ post }: { post: Post }) {
  const [score, setScore] = useState(post.score);

  return (
    <article className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
      <div className="flex gap-3">
        {/* Vote buttons */}
        <VoteButtons
          targetType="post"
          targetId={post.id}
          score={score}
          onScoreChange={setScore}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 text-sm">
            <AuthorInfo author={post.author} />
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">{timeAgo(post.created_at)}</span>
          </div>

          <Link href={`/posts/${post.id}`} className="block group">
            <p className="text-zinc-100 group-hover:text-white transition-colors">
              {post.content}
            </p>
          </Link>

          <div className="flex items-center gap-4 mt-3 text-sm">
            <Link
              href={`/posts/${post.id}`}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              💬 {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
