export interface GatewaySessionUser {
  id: string;
  email: string;
  display_name?: string;
  is_guest: boolean;
}

export interface GatewaySessionResponse {
  token: string;
  refresh_token?: string;
  refresh_session_id?: string;
  refresh_expires_at?: string;
  matrix_access_token?: string;
  matrix_homeserver?: string;
  user: GatewaySessionUser;
}

export interface SessionUser {
  id: string;
  email: string;
  displayName?: string;
  isGuest: boolean;
}

export interface Session {
  accessToken: string;
  refreshToken?: string;
  refreshSessionId?: string;
  refreshExpiresAt?: Date;
  matrixAccessToken?: string;
  matrixHomeserver?: string;
  user: SessionUser;
  raw: GatewaySessionResponse;
}

export interface RefreshSessionParams {
  sessionId: string;
  refreshToken: string;
}

export interface AuthClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

export interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  statusText?: string;
  text(): Promise<string>;
}

export type FetchLike = (input: string, init?: FetchInit) => Promise<FetchResponseLike>;

export class AuthClient {
  private readonly baseUrl: string;
  private readonly fetchImpl?: FetchLike;

  constructor(options: AuthClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:8080';
    this.fetchImpl = options.fetchImpl ?? (typeof globalThis.fetch === 'function' ? (globalThis.fetch as FetchLike) : undefined);
  }

  async login(email: string, password: string): Promise<Session> {
    const response = await this.request<GatewaySessionResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return normalizeSessionResponse(response);
  }

  async register(email: string, password: string, displayName?: string): Promise<Session> {
    const response = await this.request<GatewaySessionResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
    return normalizeSessionResponse(response);
  }

  async guest(displayName?: string): Promise<Session> {
    const response = await this.request<GatewaySessionResponse>('/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ display_name: displayName }),
    });
    return normalizeSessionResponse(response);
  }

  async refresh(params: RefreshSessionParams): Promise<Session> {
    const response = await this.request<GatewaySessionResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({
        session_id: params.sessionId,
        refresh_token: params.refreshToken,
      }),
    });
    return normalizeSessionResponse(response);
  }

  private async request<T>(path: string, init: FetchInit): Promise<T> {
    const fetcher = this.resolveFetch();
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    };
    const response = await fetcher(url, { ...init, headers });

    if (!response.ok) {
      const message = await safeReadText(response);
      throw new Error(`Request to ${path} failed with status ${response.status}${message ? `: ${message}` : ''}`);
    }

    const payload = await safeReadText(response);
    if (!payload) {
      throw new Error(`Empty response payload from ${path}`);
    }

    return JSON.parse(payload) as T;
  }

  private resolveFetch(): FetchLike {
    if (!this.fetchImpl) {
      throw new Error('No fetch implementation available; provide one via AuthClientOptions.fetchImpl');
    }
    return this.fetchImpl;
  }
}

function normalizeSessionResponse(payload: GatewaySessionResponse): Session {
  return {
    accessToken: payload.token,
    refreshToken: payload.refresh_token,
    refreshSessionId: payload.refresh_session_id,
    refreshExpiresAt: payload.refresh_expires_at ? new Date(payload.refresh_expires_at) : undefined,
    matrixAccessToken: payload.matrix_access_token,
    matrixHomeserver: payload.matrix_homeserver,
    user: {
      id: payload.user.id,
      email: payload.user.email,
      displayName: payload.user.display_name,
      isGuest: payload.user.is_guest,
    },
    raw: payload,
  };
}

async function safeReadText(response: FetchResponseLike): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return '';
  }
}
