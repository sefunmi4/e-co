import bcrypt from 'bcryptjs';
import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';

import type { AuthenticatedRequest, User } from './models.js';
import { config } from './config.js';
import { store } from './store.js';

const TOKEN_EXPIRY = '7d';

export interface JwtPayload {
  sub: string;
}

export const hashPassword = async (password: string) => bcrypt.hash(password, 10);

export const verifyPassword = async (password: string, hash: string) =>
  bcrypt.compare(password, hash);

export const signToken = (user: User) =>
  jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: TOKEN_EXPIRY });

export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;
  if (!header) {
    return next();
  }
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const user = store.users.find((u) => u.id === decoded.sub);
    if (user) {
      req.user = user;
    }
  } catch (error) {
    console.warn('Failed to authenticate token', error);
  }
  return next();
};

export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
};

export const requireOfAge = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!req.user.isOfAge) {
    return res.status(403).json({ error: 'Age verification required for this action' });
  }
  return next();
};
