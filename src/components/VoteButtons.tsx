'use client';

import { useState, useRef } from 'react';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';

interface VoteButtonsProps {
  targetType: 'post' | 'reply';
  targetId: string;
  score: number;
  onScoreChange?: (newScore: number) => void;
  compact?: boolean;
}

export default function VoteButtons({
  targetType,
  targetId,
  score,
  onScoreChange,
  compact = false,
}: VoteButtonsProps) {
  const [currentScore, setCurrentScore] = useState(score);
  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [pendingVote, setPendingVote] = useState<1 | -1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const submitVote = async (value: 1 | -1, captchaToken?: string) => {
    setVoting(true);
    setError(null);

    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          value,
          captcha_token: captchaToken,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCurrentScore(data.new_score);
        setVoted(value === 1 ? 'up' : 'down');
        onScoreChange?.(data.new_score);
        setShowCaptcha(false);
        setPendingVote(null);
      } else if (data.error === 'captcha_required') {
        // Server says we need captcha - show it
        setPendingVote(value);
        setShowCaptcha(true);
      } else {
        setError(data.error || 'Vote failed');
        turnstileRef.current?.reset();
      }
    } catch {
      setError('Something went wrong');
      turnstileRef.current?.reset();
    }

    setVoting(false);
  };

  const handleVoteClick = async (value: 1 | -1) => {
    if (voted || voting) return;
    // Try to vote without captcha first (cookie might be valid)
    await submitVote(value);
  };

  const handleCaptchaSuccess = async (token: string) => {
    if (!pendingVote || voting) return;
    await submitVote(pendingVote, token);
  };

  const handleCaptchaError = () => {
    setError('Captcha failed. Try again.');
    setShowCaptcha(false);
    setPendingVote(null);
  };

  const handleClose = () => {
    setShowCaptcha(false);
    setPendingVote(null);
    setError(null);
    turnstileRef.current?.reset();
  };

  const scoreColor =
    currentScore > 0 ? 'text-green-400' :
    currentScore < 0 ? 'text-red-400' :
    'text-zinc-500';

  // Captcha modal
  const captchaModal = showCaptcha && siteKey && (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Verify you're human</h3>
          <button onClick={handleClose} className="text-zinc-500 hover:text-white">
            ✕
          </button>
        </div>
        <div className="flex justify-center">
          <Turnstile
            ref={turnstileRef}
            siteKey={siteKey}
            onSuccess={handleCaptchaSuccess}
            onError={handleCaptchaError}
            onExpire={handleCaptchaError}
            options={{
              theme: 'dark',
              size: 'normal',
            }}
          />
        </div>
        {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
      </div>
    </div>
  );

  // Dev mode fallback when no site key
  const devFallback = showCaptcha && !siteKey && (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-sm">
        <p className="text-zinc-400 mb-4 text-sm">Dev mode: No Turnstile key configured</p>
        <button
          onClick={() => pendingVote && submitVote(pendingVote, 'demo_token')}
          className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded font-medium"
        >
          Continue (demo)
        </button>
      </div>
    </div>
  );

  // Error toast (shown outside modal)
  const errorToast = error && !showCaptcha && (
    <div className="fixed bottom-4 right-4 bg-red-900 border border-red-700 text-red-200 px-4 py-2 rounded-lg text-sm z-50">
      {error}
    </div>
  );

  if (compact) {
    return (
      <>
        {captchaModal}
        {devFallback}
        {errorToast}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleVoteClick(1)}
            disabled={voting || voted !== null}
            className={`p-1 rounded transition-colors ${
              voted === 'up'
                ? 'text-green-400'
                : 'text-zinc-500 hover:text-green-400 hover:bg-green-900/20'
            } disabled:opacity-50`}
          >
            ▲
          </button>
          <span className={`text-sm font-medium min-w-[2ch] text-center ${scoreColor}`}>
            {currentScore}
          </span>
          <button
            onClick={() => handleVoteClick(-1)}
            disabled={voting || voted !== null}
            className={`p-1 rounded transition-colors ${
              voted === 'down'
                ? 'text-red-400'
                : 'text-zinc-500 hover:text-red-400 hover:bg-red-900/20'
            } disabled:opacity-50`}
          >
            ▼
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {captchaModal}
      {devFallback}
      {errorToast}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => handleVoteClick(1)}
          disabled={voting || voted !== null}
          className={`p-1.5 rounded transition-colors ${
            voted === 'up'
              ? 'text-green-400 bg-green-900/30'
              : 'text-zinc-500 hover:text-green-400 hover:bg-green-900/20'
          } disabled:opacity-50`}
        >
          ▲
        </button>
        <span className={`text-sm font-bold ${scoreColor}`}>
          {currentScore}
        </span>
        <button
          onClick={() => handleVoteClick(-1)}
          disabled={voting || voted !== null}
          className={`p-1.5 rounded transition-colors ${
            voted === 'down'
              ? 'text-red-400 bg-red-900/30'
              : 'text-zinc-500 hover:text-red-400 hover:bg-red-900/20'
          } disabled:opacity-50`}
        >
          ▼
        </button>
      </div>
    </>
  );
}
