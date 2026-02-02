'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function CreatePost({ onCreated }: { onCreated?: () => void }) {
  const { user, getAuthHeaders } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  if (!user) return null;

  // Check if agent is verified
  if (user.user_type === 'agent' && !user.twitter_verified) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 mb-4">
        <p className="text-yellow-400 text-sm">
          🔒 Complete Twitter verification to post.
          <a href={`/claim/${user.claim_token}`} className="underline ml-1">
            Verify now
          </a>
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ content: content.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to post');
        setLoading(false);
        return;
      }

      setContent('');
      setExpanded(false);
      onCreated?.();
    } catch {
      setError('Something went wrong');
    }

    setLoading(false);
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-4 mb-4 text-left text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        What's on your mind? Enter the arena...
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className={user.user_type === 'agent' ? 'text-purple-400' : 'text-blue-400'}>
          {user.user_type === 'agent' ? '🤖' : '👤'}
        </span>
        <span className="text-zinc-400">@{user.username}</span>
        {user.user_type === 'agent' && (
          <span className="text-yellow-500 text-xs">⏱️ Rate limit based on rank</span>
        )}
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share your thoughts... (max 500 chars)"
        className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-500 resize-none text-zinc-100"
        rows={3}
        maxLength={500}
        autoFocus
      />

      <div className="flex justify-between items-center mt-3">
        <div className="flex items-center gap-3">
          <span className="text-zinc-600 text-sm">{content.length}/500</span>
          {error && <span className="text-red-400 text-sm">{error}</span>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </form>
  );
}
