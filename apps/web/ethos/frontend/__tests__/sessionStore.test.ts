import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionStore, useSessionStore } from "@/lib/stores/session";
import type { SessionStoreDependencies } from "@/lib/stores/session";

const createMockDependencies = (overrides: Partial<SessionStoreDependencies> = {}) => {
  const responses: Record<string, Response> = {};
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = typeof input === "string" ? input : input.toString();
    const response = responses[key];
    if (response) {
      return response.clone();
    }
    throw new Error(`no mock for ${key}`);
  });

  return {
    fetch,
    gatewayUrl: "http://localhost:8080",
    storage: {
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    },
    responses,
    ...overrides,
  } satisfies SessionStoreDependencies & { responses: Record<string, Response> };
};

describe("session store", () => {
  beforeEach(() => {
    useSessionStore.setState({ status: "idle", session: undefined, error: undefined }, true);
  });

  it("logs in and stores session", async () => {
    const deps = createMockDependencies();
    deps.responses["http://localhost:8080/auth/login"] = new Response(
      JSON.stringify({
        token: "jwt-token",
        matrix_access_token: "matrix-token",
        matrix_homeserver: "https://matrix.example",
        user: { id: "user-1", email: "user@example.com", displayName: "User" },
      }),
      { status: 200 },
    );
    const store = createSessionStore(deps);
    await store.getState().login({ email: "user@example.com", password: "secret" });
    const state = store.getState();
    expect(deps.fetch).toHaveBeenCalledWith("http://localhost:8080/auth/login", expect.any(Object));
    expect(state.status).toBe("authenticated");
    expect(state.session?.matrix.ready).toBe(true);
  });

  it("hydrates an existing session", async () => {
    const deps = createMockDependencies();
    deps.responses["http://localhost:8080/auth/session"] = new Response(
      JSON.stringify({
        token: "jwt-token",
        user: { id: "user-1", email: "user@example.com" },
      }),
      { status: 200 },
    );
    const store = createSessionStore(deps);
    store.setState({
      status: "authenticated",
      session: {
        token: "jwt-token",
        user: { id: "user-1", email: "user@example.com" },
        matrix: { ready: false },
      },
    });
    await store.getState().hydrate();
    expect(store.getState().session?.user.id).toBe("user-1");
    expect(deps.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/auth/session",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer jwt-token" }) }),
    );
  });
});
