import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOKEN_STORAGE_KEY, GATEWAY_URL } from '../config';

export class GatewayRequestError extends Error {
  status?: number;
  hint?: string;
  cause?: unknown;

  constructor(message: string, options: { status?: number; hint?: string; cause?: unknown } = {}) {
    super(message);
    this.name = 'GatewayRequestError';
    if (options.status !== undefined) {
      this.status = options.status;
    }
    if (options.hint) {
      this.hint = options.hint;
    }
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

let inMemoryToken: string | null = null;

export const getToken = async (): Promise<string | null> => {
  if (inMemoryToken !== null) {
    return inMemoryToken;
  }
  const stored = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  inMemoryToken = stored;
  return stored;
};

export const setToken = async (token: string | null) => {
  inMemoryToken = token;
  if (!token) {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
};

type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  signal?: AbortSignal;
};

export async function request<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const token = await getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${GATEWAY_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (cause) {
    throw new GatewayRequestError('Unable to reach the Ethos gateway.', {
      cause,
      hint: `Start the gateway locally (\`cargo run -p ethos-gateway\`) or set EXPO_PUBLIC_GATEWAY_URL to the correct base URL. Current value: ${GATEWAY_URL}.`,
    });
  }

  if (!res.ok) {
    let message: string | null = null;
    try {
      message = await res.text();
    } catch (readError) {
      console.warn('Unable to read gateway error response', readError);
    }

    const error = new GatewayRequestError(message || 'Request failed', { status: res.status });

    if (res.status === 404) {
      error.hint = `The gateway at ${GATEWAY_URL} does not provide ${path}. Make sure you are running a compatible gateway or adjust EXPO_PUBLIC_GATEWAY_URL.`;
    } else if (res.status === 405) {
      error.hint = `The gateway responded that the ${options.method || 'GET'} method is not allowed for ${path}. Check that your gateway is up to date.`;
    }

    throw error;
  }

  if (res.status === 204 || res.status === 205) {
    return null as T;
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await res.json()) as T;
  }

  return (await res.text()) as T;
}

export async function register(email: string, password: string) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string) {
  const data = await request<{ token?: string; [key: string]: unknown }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) {
    await setToken(data.token as string);
  }
  return data;
}

export async function guestLogin(displayName?: string) {
  const payload = displayName ? { display_name: displayName } : {};
  const data = await request<{ token?: string; [key: string]: unknown }>('/auth/guest', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (data.token) {
    await setToken(data.token as string);
  }
  return data;
}

export async function getSession() {
  return request('/auth/session');
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
  } catch (error) {
    console.warn('Failed to call logout endpoint', error);
  } finally {
    await setToken(null);
  }
}
