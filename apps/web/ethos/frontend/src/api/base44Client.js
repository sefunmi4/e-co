import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "68a3bdbce030093c8efa4212", 
  requiresAuth: true // Ensure authentication is required for all operations
});
