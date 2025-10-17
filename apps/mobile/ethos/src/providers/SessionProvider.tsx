import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AuthClient, Session } from '@eco/js-sdk/auth';
import { getGatewayUrl } from '@/utils/config';

type SessionContextValue = {
  session: Session | null;
  hydrated: boolean;
  loading: boolean;
  error?: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInAsGuest: (displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

const SESSION_STORAGE_KEY = 'ethos.session';

type PersistedSession = Omit<Session, 'refreshExpiresAt'> & {
  refreshExpiresAt?: string;
};

function serializeSession(session: Session): PersistedSession {
  return {
    ...session,
    refreshExpiresAt: session.refreshExpiresAt?.toISOString(),
  };
}

function deserializeSession(payload: PersistedSession): Session {
  return {
    ...payload,
    refreshExpiresAt: payload.refreshExpiresAt ? new Date(payload.refreshExpiresAt) : undefined,
  };
}

export const SessionProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => new AuthClient({ baseUrl: getGatewayUrl() }), []);
  const pending = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const raw = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
        if (!raw) {
          return;
        }

        const parsed = deserializeSession(JSON.parse(raw) as PersistedSession);
        if (!isMounted) {
          return;
        }

        if (
          parsed.refreshToken &&
          parsed.refreshSessionId &&
          parsed.refreshExpiresAt &&
          parsed.refreshExpiresAt.getTime() <= Date.now()
        ) {
          try {
            const refreshed = await client.refresh({
              refreshToken: parsed.refreshToken,
              sessionId: parsed.refreshSessionId,
            });
            if (!isMounted) {
              return;
            }
            await SecureStore.setItemAsync(
              SESSION_STORAGE_KEY,
              JSON.stringify(serializeSession(refreshed))
            );
            setSession(refreshed);
          } catch (refreshError) {
            console.warn('Failed to refresh session', refreshError);
            await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
            setSession(null);
          }
        } else {
          setSession(parsed);
        }
      } catch (storageError) {
        console.warn('Failed to hydrate session', storageError);
        await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
        setSession(null);
      } finally {
        if (isMounted) {
          setHydrated(true);
        }
      }
    };

    hydrate();

    return () => {
      isMounted = false;
    };
  }, [client]);

  const execute = useCallback(
    async (operation: () => Promise<Session>) => {
      if (pending.current) {
        return pending.current;
      }

      setLoading(true);
      setError(null);

      const promise = operation()
        .then(async (value) => {
          setSession(value);
          await SecureStore.setItemAsync(
            SESSION_STORAGE_KEY,
            JSON.stringify(serializeSession(value))
          );
        })
        .catch((err) => {
          console.error(err);
          setError(err instanceof Error ? err.message : 'Unknown error');
          throw err;
        })
        .finally(() => {
          pending.current = null;
          setLoading(false);
        }) as Promise<void>;

      pending.current = promise;
      return promise;
    },
    []
  );

  const signIn = useCallback(
    (email: string, password: string) =>
      execute(() => client.login(email.trim().toLowerCase(), password)),
    [client, execute]
  );

  const signUp = useCallback(
    (email: string, password: string, displayName?: string) =>
      execute(() => client.register(email.trim().toLowerCase(), password, displayName?.trim() || undefined)),
    [client, execute]
  );

  const signInAsGuest = useCallback(
    (displayName?: string) => execute(() => client.guest(displayName?.trim() || undefined)),
    [client, execute]
  );

  const signOut = useCallback(async () => {
    setSession(null);
    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      hydrated,
      loading,
      error,
      signIn,
      signUp,
      signInAsGuest,
      signOut,
    }),
    [error, hydrated, loading, session, signIn, signInAsGuest, signOut, signUp]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export function useSessionContext(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
}
