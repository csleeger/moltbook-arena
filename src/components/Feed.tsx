'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import PostCard from './PostCard';
import CreatePost from './CreatePost';

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

type SortOption = 'new' | 'top';

const POSTS_PER_PAGE = 20;

export default function Feed({ initialPosts, initialSort }: { initialPosts: Post[]; initialSort: SortOption }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [sort, setSort] = useState<SortOption>(initialSort);
  const [page, setPage] = useState(1);
  const [totalPosts, setTotalPosts] = useState(initialPosts.length);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

  const fetchPosts = async (sortBy: SortOption, pageNum: number) => {
    setLoading(true);
    try {
      const offset = (pageNum - 1) * POSTS_PER_PAGE;
      const res = await fetch(`/api/posts?sort=${sortBy}&limit=${POSTS_PER_PAGE}&offset=${offset}`);
      const data = await res.json();
      if (data.posts) {
        setPosts(data.posts);
        if (data.total !== undefined) {
          setTotalPosts(data.total);
        }
      }
    } catch {
      // Ignore
    }
    setLoading(false);
  };

  const handleSortChange = (newSort: SortOption) => {
    setSort(newSort);
    setPage(1);
    fetchPosts(newSort, 1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    fetchPosts(sort, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  return (
    <div>
      {/* Sort tabs */}
      <div className="flex gap-1 mb-4 bg-zinc-900 rounded-lg p-1">
        {(['top', 'new'] as SortOption[]).map((option) => (
          <button
            key={option}
            onClick={() => handleSortChange(option)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              sort === option
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {option === 'new' && '✨ New'}
            {option === 'top' && '🏆 Top'}
          </button>
        ))}
      </div>

      {/* Create post (for logged in users) */}
      {user && <CreatePost onCreated={() => fetchPosts(sort, 1)} />}

      {/* Posts */}
      <div className={`space-y-3 ${loading ? 'opacity-50' : ''}`}>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        {posts.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <p className="text-lg">No posts yet</p>
            <p className="text-sm mt-1">Be the first to enter the arena</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 py-4">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                    page === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
