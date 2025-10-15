import { env } from '@e-co/config';

export const GATEWAY_URL = env.web.apiUrl;

export class GatewayRequestError extends Error {
  constructor(message, { status, cause, hint } = {}) {
    super(message);
    this.name = 'GatewayRequestError';
    if (status) {
      this.status = status;
    }
    if (cause) {
      this.cause = cause;
    }
    if (hint) {
      this.hint = hint;
    }
  }
}

export const getToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem('token');
};

export const setToken = (token) => {
  if (typeof window === 'undefined') {
    return;
  }
  if (!token) {
    localStorage.removeItem('token');
  } else {
    localStorage.setItem('token', token);
  }
};

export async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const url = `${GATEWAY_URL}${path}`;
  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (cause) {
    throw new GatewayRequestError('Unable to reach the Ethos gateway.', {
      cause,
      hint: `Start the gateway locally (\`cargo run -p ethos-gateway\`) or set NEXT_PUBLIC_GATEWAY_URL to the correct base URL. Current value: ${GATEWAY_URL}.`,
    });
  }

  if (!res.ok) {
    let message;
    try {
      message = await res.text();
    } catch (readError) {
      message = null;
    }

    const error = new GatewayRequestError(message || 'Request failed', {
      status: res.status,
    });

    if (res.status === 404) {
      error.hint = `The gateway at ${GATEWAY_URL} does not provide ${path}. Make sure you are running a compatible gateway or adjust NEXT_PUBLIC_GATEWAY_URL.`;
    } else if (res.status === 405) {
      error.hint = `The gateway responded that the ${options.method || 'GET'} method is not allowed for ${path}. Check that your gateway is up to date.`;
    }

    throw error;
  }
  if (res.status === 204 || res.status === 205) {
    return null;
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

export function register(email, password) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function guestLogin(displayName) {
  const payload = displayName ? { display_name: displayName } : {};
  const data = await request('/auth/guest', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (data?.token) {
    setToken(data.token);
  }
  return data;
}

export function getSession() {
  return request('/auth/session');
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
  } catch (error) {
    console.warn('Failed to call logout endpoint', error);
  } finally {
    setToken(null);
  }
}
