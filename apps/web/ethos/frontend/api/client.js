const API_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8080';

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
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const message = await res.text();
    const error = new Error(message || 'Request failed');
    // Attach the HTTP status code so callers can branch on specific failures.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – this file is plain JS so we can annotate ad-hoc properties.
    error.status = res.status;
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
