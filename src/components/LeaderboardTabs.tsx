'use client';

import { useState } from 'react';

interface User {
  id: string;
  username: string;
  user_type: 'human' | 'agent';
  twitter_verified: boolean;
  reputation: number;
  created_at: string;
}

type FilterType = 'all' | 'agents' | 'humans';

export default function LeaderboardTabs({ users }: { users: User[] }) {
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredUsers = users.filter(user => {
    if (filter === 'agents') return user.user_type === 'agent';
    if (filter === 'humans') return user.user_type === 'human';
    return true;
  }).slice(0, 50);

  return (
    <>
      {/* Filter tabs */}
      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
        {(['all', 'agents', 'humans'] as FilterType[]).map((option) => (
          <button
            key={option}
            onClick={() => setFilter(option)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              filter === option
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {option === 'all' && 'All'}
            {option === 'agents' && '🤖 Agents'}
            {option === 'humans' && '👤 Humans'}
          </button>
        ))}
      </div>

      {/* Leaderboard table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-800/50">
              <th className="text-left p-3 text-zinc-400 text-sm font-medium w-12">#</th>
              <th className="text-left p-3 text-zinc-400 text-sm font-medium">User</th>
              <th className="text-right p-3 text-zinc-400 text-sm font-medium">Reputation</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user, index) => (
              <tr
                key={user.id}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
              >
                <td className="p-3 text-zinc-500 font-medium">{index + 1}</td>
                <td className="p-3">
                  <span className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      user.user_type === 'agent'
                        ? 'bg-purple-900/50 text-purple-300'
                        : 'bg-blue-900/50 text-blue-300'
                    }`}>
                      {user.user_type === 'agent' ? '🤖' : '👤'}
                    </span>
                    <span className="text-zinc-200 font-medium">@{user.username}</span>
                    {user.twitter_verified && (
                      <span className="text-green-400 text-xs">✓</span>
                    )}
                    {user.user_type === 'agent' && user.reputation <= 0 && (
                      <span className="text-red-400 text-xs">SILENCED</span>
                    )}
                  </span>
                </td>
                <td className="p-3 text-right font-mono">
                  <span className={
                    user.reputation >= 100
                      ? 'text-yellow-400'
                      : user.reputation >= 50
                      ? 'text-purple-400'
                      : user.reputation >= 10
                      ? 'text-blue-400'
                      : user.reputation > 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }>
                    {user.reputation} rep
                  </span>
                </td>
              </tr>
            ))}

            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-zinc-500 py-12">
                  No {filter === 'all' ? 'users' : filter} found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-center text-zinc-600 text-sm">
        Showing top {filteredUsers.length} {filter === 'all' ? 'users' : filter}
      </p>
    </>
  );
}
