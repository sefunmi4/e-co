import { Router } from 'express';

import { hashPassword, signToken, verifyPassword } from '../auth.js';
import type { AuthenticatedRequest } from '../models.js';
import { isOfLegalAge } from '../utils/age.js';
import { generateId, now, store } from '../store.js';

export const authRouter = Router();

authRouter.post('/signup', async (req, res) => {
  const { email, password, displayName, roles = [], country, dateOfBirth, bio, socials } =
    req.body ?? {};
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'email, password and displayName are required' });
  }
  if (store.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const passwordHash = await hashPassword(password);
  const timestamp = now();
  const user = {
    id: generateId(),
    email,
    passwordHash,
    displayName,
    roles,
    country,
    dateOfBirth,
    isOfAge: isOfLegalAge(dateOfBirth, country),
    bio,
    socials,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.users.push(user);
  const token = signToken(user);
  const { passwordHash: _, ...publicUser } = user;
  return res.status(201).json({ user: publicUser, token });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const user = store.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken(user);
  const { passwordHash: _, ...publicUser } = user;
  return res.json({ user: publicUser, token });
});

authRouter.get('/me', (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { passwordHash: _, ...publicUser } = req.user;
  return res.json({ user: publicUser });
});
