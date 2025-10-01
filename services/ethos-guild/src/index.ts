import express from 'express';

import { createApiRouter } from './routes/index.js';

export const createServer = () => {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(createApiRouter());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  return app;
};
