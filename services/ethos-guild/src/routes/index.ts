import { Router } from 'express';

import { authenticate } from '../auth.js';
import { authRouter } from './auth.js';
import { artifactsRouter } from './artifacts.js';
import { reviewsRouter } from './reviews.js';
import { collabsRouter } from './collabs.js';
import { ordersRouter, stripeWebhookRouter } from './orders.js';
import { eventsRouter } from './events.js';
import { venuesRouter } from './venues.js';
import { qrRouter } from './qr.js';
import { discoverRouter } from './discover.js';

export const createApiRouter = () => {
  const router = Router();
  router.use(authenticate);
  router.use('/auth', authRouter);
  router.use('/artifacts', artifactsRouter);
  router.use('/artifacts/:id/reviews', reviewsRouter);
  router.use('/collabs', collabsRouter);
  router.use('/orders', ordersRouter);
  router.use('/webhooks', stripeWebhookRouter);
  router.use('/events', eventsRouter);
  router.use('/venues', venuesRouter);
  router.use('/qr', qrRouter);
  router.use('/discover', discoverRouter);
  return router;
};
