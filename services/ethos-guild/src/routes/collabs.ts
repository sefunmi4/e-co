import { Router } from 'express';

import type { AuthenticatedRequest, CollabAgreement, CollabSplit } from '../models.js';
import { requireAuth } from '../auth.js';
import { computePayouts } from '../utils/payouts.js';
import { generateId, now, store } from '../store.js';

const splitsTotal = (splits: CollabSplit[]) => splits.reduce((sum, split) => sum + split.percent, 0);

export const collabsRouter = Router();

collabsRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const { artifactId, splits, termsUrl, status = 'DRAFT' } = req.body ?? {};
  if (!artifactId || !Array.isArray(splits) || splits.length === 0) {
    return res.status(400).json({ error: 'artifactId and splits are required' });
  }
  const artifact = store.artifacts.find((a) => a.id === artifactId);
  if (!artifact) {
    return res.status(404).json({ error: 'Artifact not found' });
  }
  if (artifact.ownerId !== req.user!.id) {
    return res.status(403).json({ error: 'Only the owner can create collab agreements' });
  }
  if (Math.round(splitsTotal(splits)) !== 100) {
    return res.status(400).json({ error: 'Splits must total 100 percent' });
  }
  const timestamp = now();
  const agreement: CollabAgreement = {
    id: generateId(),
    artifactId,
    splits,
    termsUrl,
    status,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.collabs.push(agreement);
  const preview = computePayouts(10000, 10, splits);
  return res.status(201).json({ collab: agreement, preview });
});

collabsRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const collab = store.collabs.find((c) => c.id === req.params.id);
  if (!collab) {
    return res.status(404).json({ error: 'Collab not found' });
  }
  const artifact = store.artifacts.find((a) => a.id === collab.artifactId);
  if (!artifact || (artifact.ownerId !== req.user!.id && !(artifact.collaborators ?? []).includes(req.user!.id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json({ collab });
});

collabsRouter.patch('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const collab = store.collabs.find((c) => c.id === req.params.id);
  if (!collab) {
    return res.status(404).json({ error: 'Collab not found' });
  }
  const artifact = store.artifacts.find((a) => a.id === collab.artifactId);
  if (!artifact || artifact.ownerId !== req.user!.id) {
    return res.status(403).json({ error: 'Only the owner can update collab agreements' });
  }
  if (req.body.splits) {
    if (!Array.isArray(req.body.splits) || req.body.splits.length === 0) {
      return res.status(400).json({ error: 'splits must be an array' });
    }
    if (Math.round(splitsTotal(req.body.splits)) !== 100) {
      return res.status(400).json({ error: 'Splits must total 100 percent' });
    }
    collab.splits = req.body.splits;
  }
  if (req.body.termsUrl !== undefined) {
    collab.termsUrl = req.body.termsUrl;
  }
  if (req.body.status) {
    collab.status = req.body.status;
  }
  collab.updatedAt = now();
  return res.json({ collab });
});
