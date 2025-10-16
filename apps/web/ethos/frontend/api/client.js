import { env } from '@e-co/config';
import { trackCheckoutStarted, trackSaleRecorded } from '@/lib/analytics';

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
  const method = (options.method || 'GET').toUpperCase();
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
    maybeTrackAnalytics(path, method, options.body, null);
    return null;
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const payload = await res.json();
    maybeTrackAnalytics(path, method, options.body, payload);
    return payload;
  }
  const text = await res.text();
  maybeTrackAnalytics(path, method, options.body, text);
  return text;
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


const SALE_STATUSES = new Set(['completed', 'fulfilled', 'paid']);

function parseJsonBody(body) {
  if (!body || typeof body !== 'string') {
    return null;
  }
  try {
    return JSON.parse(body);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Failed to parse request body for analytics', error);
    }
    return null;
  }
}

function maybeTrackAnalytics(path, method, rawRequestBody, responseBody) {
  if (typeof window === 'undefined') {
    return;
  }
  if (!path.startsWith('/api/')) {
    return;
  }
  const requestPayload = parseJsonBody(rawRequestBody);
  if (method === 'POST' && path === '/api/orders') {
    if (!responseBody || typeof responseBody !== 'object') {
      return;
    }
    const items = Array.isArray(responseBody.items) ? responseBody.items : [];
    const itemCount = items.reduce((total, item) => {
      if (item && typeof item.quantity === 'number') {
        return total + Math.max(0, item.quantity);
      }
      if (item && item.item && typeof item.item.quantity === 'number') {
        return total + Math.max(0, item.item.quantity);
      }
      return total;
    }, 0);
    void trackCheckoutStarted({
      orderId: responseBody.order?.id,
      userId: responseBody.order?.user_id,
      cartTotalCents: responseBody.order?.total_cents,
      itemCount,
      metadata:
        requestPayload && typeof requestPayload === 'object'
          ? requestPayload.metadata
          : undefined,
    });
    return;
  }
  if (method === 'PUT' && path.startsWith('/api/orders/')) {
    if (!responseBody || typeof responseBody !== 'object') {
      return;
    }
    const responseStatus =
      responseBody.order && typeof responseBody.order.status === 'string'
        ? responseBody.order.status.toLowerCase()
        : undefined;
    const requestedStatus =
      requestPayload && typeof requestPayload === 'object' && typeof requestPayload.status === 'string'
        ? requestPayload.status.toLowerCase()
        : undefined;
    const target = responseStatus || requestedStatus;
    if (!target || !SALE_STATUSES.has(target)) {
      return;
    }
    const orderId = responseBody.order?.id;
    const userId = responseBody.order?.user_id;
    const totalCents = responseBody.order?.total_cents;
    if (typeof orderId === 'string' && typeof userId === 'string' && typeof totalCents === 'number') {
      void trackSaleRecorded({
        orderId,
        userId,
        totalCents,
        status: responseBody.order?.status ?? requestPayload?.status,
      });
    }
  }
}

