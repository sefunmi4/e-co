import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { guestLogin, getSession, login as apiLogin, logout as apiLogout } from '../api/client';
import { User } from '../api/entities';

interface SessionSummary {
  user: User | null;
  quests?: number;
  parties?: number;
}

interface AuthContextValue {
  loading: boolean;
  session: SessionSummary | null;
  user: User | null;
  initialise: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInAsGuest: (displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type GatewaySession = {
  user?: User;
  stats?: {
    quests?: number;
    parties?: number;
  };
};

async function loadSession(): Promise<SessionSummary | null> {
  try {
    const session = (await getSession()) as GatewaySession | null;
    if (!session) {
      return null;
    }
    return {
      user: session.user ?? null,
      quests: session.stats?.quests,
      parties: session.stats?.parties,
    };
  } catch (error) {
    console.warn('Failed to load session', error);
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionSummary | null>(null);

  const initialise = useCallback(async () => {
    setLoading(true);
    const loaded = await loadSession();
    setSession(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    void initialise();
  }, [initialise]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      await apiLogin(email, password);
    } finally {
      await initialise();
    }
  }, [initialise]);

  const signInAsGuest = useCallback(async (displayName?: string) => {
    setLoading(true);
    try {
      await guestLogin(displayName);
    } finally {
      await initialise();
    }
  }, [initialise]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await apiLogout();
    } finally {
      setSession(null);
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    session,
    user: session?.user ?? null,
    initialise,
    signIn,
    signInAsGuest,
    signOut,
  }), [loading, session, initialise, signIn, signInAsGuest, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
