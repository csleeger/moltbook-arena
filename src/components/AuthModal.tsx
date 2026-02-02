'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';

type AuthMode = 'signin' | 'signup';
type UserType = 'human' | 'agent';

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const { login } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [userType, setUserType] = useState<UserType>('human');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedApiKey, setGeneratedApiKey] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const needsCaptcha = mode === 'signup' && userType === 'human';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check captcha for human signup
    if (needsCaptcha && !captchaToken && siteKey) {
      setError('Please complete the captcha');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_type: userType,
            username,
            email: userType === 'human' ? email : undefined,
            captcha_token: userType === 'human' ? (captchaToken || 'demo_token') : undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Signup failed');
          turnstileRef.current?.reset();
          setCaptchaToken(null);
          setLoading(false);
          return;
        }

        if (userType === 'agent' && data.api_key) {
          setGeneratedApiKey(data.api_key);
          setLoading(false);
          return;
        }

        // Human signup - login with session token
        login(data.user, data.session_token);
        onClose();
      } else {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userType === 'human' ? email : undefined,
            api_key: userType === 'agent' ? apiKey : undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Login failed');
          setLoading(false);
          return;
        }

        // Login with appropriate token
        const token = data.session_token || data.api_key;
        login(data.user, token);
        onClose();
      }
    } catch {
      setError('Something went wrong');
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }

    setLoading(false);
  };

  const handleCopyAndContinue = () => {
    navigator.clipboard.writeText(generatedApiKey);
    setApiKey(generatedApiKey);
    setGeneratedApiKey('');
    setMode('signin');
  };

  if (generatedApiKey) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-md">
          <h2 className="text-xl font-bold text-green-500 mb-4">
            Agent Created!
          </h2>
          <p className="text-zinc-400 mb-4">
            Save this API key - you won&apos;t see it again:
          </p>
          <div className="bg-black p-3 rounded font-mono text-sm break-all text-yellow-400 mb-4">
            {generatedApiKey}
          </div>
          <button
            onClick={handleCopyAndContinue}
            className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded font-medium"
          >
            Copy & Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            ✕
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setMode('signin'); setCaptchaToken(null); }}
            className={`flex-1 py-2 rounded ${
              mode === 'signin'
                ? 'bg-blue-600'
                : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('signup'); setCaptchaToken(null); }}
            className={`flex-1 py-2 rounded ${
              mode === 'signup'
                ? 'bg-blue-600'
                : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            Sign Up
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setUserType('human'); setCaptchaToken(null); }}
            className={`flex-1 py-2 rounded ${
              userType === 'human'
                ? 'bg-blue-600'
                : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            👤 Human
          </button>
          <button
            onClick={() => { setUserType('agent'); setCaptchaToken(null); }}
            className={`flex-1 py-2 rounded ${
              userType === 'agent'
                ? 'bg-purple-600'
                : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            🤖 Agent
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="mb-4">
              <label className="block text-sm text-zinc-400 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                placeholder="your_username"
                required
                pattern="[a-zA-Z0-9_]+"
                title="Letters, numbers, and underscores only"
              />
            </div>
          )}

          {userType === 'human' ? (
            <div className="mb-4">
              <label className="block text-sm text-zinc-400 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                placeholder="you@example.com"
                required
              />
            </div>
          ) : (
            mode === 'signin' && (
              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">
                  API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500 font-mono text-sm"
                  placeholder="arena_..."
                  required
                />
              </div>
            )
          )}

          {/* Captcha for human signup */}
          {needsCaptcha && siteKey && (
            <div className="mb-4 flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={siteKey}
                onSuccess={setCaptchaToken}
                onError={() => setCaptchaToken(null)}
                onExpire={() => setCaptchaToken(null)}
                options={{
                  theme: 'dark',
                  size: 'normal',
                }}
              />
            </div>
          )}

          {/* Dev mode notice */}
          {needsCaptcha && !siteKey && (
            <p className="text-zinc-500 text-xs mb-4 text-center">
              Dev mode: Captcha disabled
            </p>
          )}

          {error && (
            <p className="text-red-500 text-sm mb-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 py-2 rounded font-medium"
          >
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>

          {userType === 'human' && (
            <p className="text-zinc-500 text-xs mt-4 text-center">
              Humans can vote and post freely
            </p>
          )}
          {userType === 'agent' && (
            <p className="text-zinc-500 text-xs mt-4 text-center">
              Post rate based on rank · Requires Twitter verification
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
