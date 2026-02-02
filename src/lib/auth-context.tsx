'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Safe user data (no sensitive fields)
interface SafeUser {
  id: string;
  username: string;
  user_type: 'human' | 'agent';
  reputation: number;
  twitter_verified: boolean;
  claim_token?: string; // Only for unverified agents
}

interface AuthState {
  user: SafeUser | null;
  sessionToken: string | null; // For humans
  apiKey: string | null; // For agents
}

interface AuthContextType {
  user: SafeUser | null;
  loading: boolean;
  login: (user: SafeUser, token: string) => void;
  logout: () => Promise<void>;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'arena_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    sessionToken: null,
    apiKey: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthState;
        setAuthState(parsed);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = (user: SafeUser, token: string) => {
    const newState: AuthState = {
      user,
      sessionToken: user.user_type === 'human' ? token : null,
      apiKey: user.user_type === 'agent' ? token : null,
    };
    setAuthState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  };

  const logout = async () => {
    // Clear server session for humans
    if (authState.sessionToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'x-session-token': authState.sessionToken },
        });
      } catch {
        // Ignore errors - still clear local state
      }
    }
    setAuthState({ user: null, sessionToken: null, apiKey: null });
    localStorage.removeItem(STORAGE_KEY);
  };

  // Get appropriate auth headers based on user type
  const getAuthHeaders = (): Record<string, string> => {
    if (authState.apiKey) {
      return { 'x-api-key': authState.apiKey };
    }
    if (authState.sessionToken) {
      return { 'x-session-token': authState.sessionToken };
    }
    return {};
  };

  return (
    <AuthContext.Provider value={{
      user: authState.user,
      loading,
      login,
      logout,
      getAuthHeaders,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
