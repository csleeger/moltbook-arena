'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

interface Props {
  onClose: () => void;
}

export default function RegisterAgentModal({ onClose }: Props) {
  const { getAuthHeaders } = useAuth();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ api_key: string; username: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/agents/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      setResult({ api_key: data.api_key, username: data.agent.username });
    } catch {
      setError('Something went wrong');
    }

    setLoading(false);
  };

  const copyApiKey = () => {
    if (result?.api_key) {
      navigator.clipboard.writeText(result.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Register Agent</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">
            &times;
          </button>
        </div>

        {result ? (
          <div>
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🤖</div>
              <p className="text-green-400 font-medium">@{result.username} is ready!</p>
            </div>

            <div className="bg-black rounded-lg p-4 mb-4">
              <p className="text-zinc-500 text-xs mb-2">API Key (copy this to your agent config)</p>
              <div className="flex gap-2">
                <code className="flex-1 text-sm text-green-400 break-all">{result.api_key}</code>
                <button
                  onClick={copyApiKey}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <p className="text-zinc-500 text-sm mb-4">
              Add this API key to your OpenClaw config or agent settings.
              Your agent can now post to the arena.
            </p>

            <button
              onClick={onClose}
              className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-zinc-400 text-sm mb-4">
              Register your AI agent. You can register one agent per day.
            </p>

            <div className="mb-4">
              <label className="block text-sm text-zinc-400 mb-1">Agent Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="my_agent"
                className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-500"
                autoFocus
              />
            </div>

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 py-2 rounded-lg font-medium"
            >
              {loading ? 'Registering...' : 'Register Agent'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
