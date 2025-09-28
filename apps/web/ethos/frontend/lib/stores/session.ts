"use client";

import { create } from "zustand";
import { devtools, persist, createJSONStorage, StateStorage } from "zustand/middleware";

type SessionStatus = "idle" | "loading" | "authenticated" | "error";

export interface SessionUser {
  id: string;
  email: string;
  displayName?: string | null;
}

interface SessionResponseUser {
  id: string;
  email: string;
  display_name?: string | null;
}

export interface MatrixState {
  ready: boolean;
  homeserver?: string;
  accessToken?: string;
}

export interface Session {
  token: string;
  user: SessionUser;
  matrix: MatrixState;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

interface SessionResponse {
  token: string;
  matrix_access_token?: string;
  matrix_homeserver?: string;
  user: SessionResponseUser;
}

export interface SessionStoreState {
  status: SessionStatus;
  session?: Session;
  error?: string;
  login: (request: LoginRequest) => Promise<void>;
  register: (request: RegisterRequest) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => void;
}

export interface SessionStoreDependencies {
  fetch: typeof fetch;
  gatewayUrl: string;
  storage?: StateStorage;
}

const memoryStorage: StateStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

const defaultDependencies: SessionStoreDependencies = {
  fetch: typeof fetch !== "undefined" ? fetch.bind(globalThis) : (() => Promise.reject(new Error("fetch unavailable"))) as typeof fetch,
  gatewayUrl: process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8080",
};

const normalizeSession = (payload: SessionResponse): Session => {
  const { display_name, ...user } = payload.user;
  return {
    token: payload.token,
    matrix: {
      ready: Boolean(payload.matrix_access_token),
      homeserver: payload.matrix_homeserver,
      accessToken: payload.matrix_access_token,
    },
    user: {
      id: user.id,
      email: user.email,
      displayName: display_name === undefined ? undefined : display_name,
    },
  };
};

export const createSessionStore = (
  dependencies: SessionStoreDependencies = defaultDependencies,
) =>
  create<SessionStoreState>()(
    devtools(
      persist(
        (set, get) => {
          const authenticate = async (path: string, body: Record<string, unknown>) => {
            set({ status: "loading", error: undefined });
            try {
              const response = await dependencies.fetch(`${dependencies.gatewayUrl}${path}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
              });

              if (!response.ok) {
                const text = await response.text();
                throw new Error(text || "Failed to authenticate");
              }

              const payload = (await response.json()) as SessionResponse;
              const session = normalizeSession(payload);
              set({ session, status: "authenticated", error: undefined });
            } catch (error) {
              set({
                status: "error",
                error: error instanceof Error ? error.message : "Unable to authenticate",
              });
            }
          };

          return {
            status: "idle" as SessionStatus,
            session: undefined,
            error: undefined,
            async login({ email, password }) {
              await authenticate("/auth/login", { email, password });
            },
            async register({ email, password, displayName }) {
              await authenticate("/auth/register", {
                email,
                password,
                display_name: displayName,
              });
            },
          async hydrate() {
            const { session } = get();
            if (!session) return;
            try {
              const response = await dependencies.fetch(`${dependencies.gatewayUrl}/auth/session`, {
                headers: {
                  Authorization: `Bearer ${session.token}`,
                },
              });
              if (!response.ok) {
                throw new Error("Failed to hydrate session");
              }
              const payload = (await response.json()) as SessionResponse;
              set({
                status: "authenticated",
                session: normalizeSession(payload),
                error: undefined,
              });
            } catch (error) {
              set({ status: "error", error: error instanceof Error ? error.message : "Unable to hydrate" });
            }
          },
          logout() {
            set({ session: undefined, status: "idle", error: undefined });
          },
          };
        },
        {
          name: "ethos-session",
          storage: createJSONStorage(() => dependencies.storage ?? (typeof window !== "undefined" ? window.localStorage : memoryStorage)),
          partialize: (state) => ({ session: state.session }),
          onRehydrateStorage: () => (state) => {
            if (state?.session) {
              state.status = "authenticated";
            }
          },
        },
      ),
    ),
  );

export const useSessionStore = createSessionStore();
