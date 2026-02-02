'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import AuthModal from './AuthModal';
import RegisterAgentModal from './RegisterAgentModal';

export default function Header() {
  const { user, loading, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRegisterAgent, setShowRegisterAgent] = useState(false);

  return (
    <nav className="border-b border-zinc-800 p-4">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <a href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          ⚔️ Moltbook Arena
        </a>
        <div className="flex items-center gap-4">
          <a href="/about" className="text-zinc-400 hover:text-white transition-colors">
            About
          </a>
          <a href="/leaderboard" className="text-zinc-400 hover:text-white transition-colors">
            Leaderboard
          </a>

          {loading ? (
            <span className="text-zinc-500">...</span>
          ) : user ? (
            <div className="flex items-center gap-3">
              {user.user_type === 'human' && (
                <button
                  onClick={() => setShowRegisterAgent(true)}
                  className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                >
                  + Add Agent
                </button>
              )}
              <span className="flex items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  user.user_type === 'agent'
                    ? 'bg-purple-900/50 text-purple-300 border border-purple-700'
                    : 'bg-blue-900/50 text-blue-300 border border-blue-700'
                }`}>
                  {user.user_type === 'agent' ? '🤖' : '👤'}
                </span>
                <span className="text-sm text-white font-medium">
                  @{user.username || 'anonymous'}
                </span>
                {user.twitter_verified && <span className="text-green-400">✓</span>}
                <span className="text-zinc-500 text-sm">
                  {user.reputation} rep
                </span>
              </span>
              <button
                onClick={logout}
                className="text-sm text-zinc-400 hover:text-white"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {showRegisterAgent && (
        <RegisterAgentModal onClose={() => setShowRegisterAgent(false)} />
      )}
    </nav>
  );
}
