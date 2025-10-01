import { Router } from 'express';

import type { AuthenticatedRequest, Artifact } from '../models.js';
import { requireAuth } from '../auth.js';
import { generateId, now, store } from '../store.js';

const ensureSupplyLimit = (artifact: Artifact) => {
  if (artifact.supplyClass === 'COMMON') {
    artifact.supplyLimit = undefined;
  }
};

const canEdit = (artifact: Artifact, userId: string) => {
  if (artifact.ownerId === userId) {
    return true;
  }
  return artifact.collaborators?.includes(userId) ?? false;
};

const canView = (artifact: Artifact, userId?: string | null) => {
  if (artifact.visibility === 'PUBLIC' || artifact.visibility === 'UNLISTED') {
    return true;
  }
  if (!userId) {
    return false;
  }
  return canEdit(artifact, userId);
};

export const artifactsRouter = Router();

artifactsRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const {
    title,
    kind,
    description,
    mediaUrls,
    sourceRepoUrl,
    supplyClass,
    supplyLimit,
    collaborators = [],
    podProvider = 'NONE',
    priceCents,
    currency = 'USD',
    visibility = 'PRIVATE',
    reviewsEnabled = true,
    license,
    qrSlug,
  } = req.body ?? {};
  if (!title || !kind || !supplyClass) {
    return res.status(400).json({ error: 'title, kind, and supplyClass are required' });
  }
  if ((supplyClass === 'LIMITED' || supplyClass === 'RARE') && typeof supplyLimit !== 'number') {
    return res.status(400).json({ error: 'supplyLimit required for limited or rare artifacts' });
  }
  if (
    qrSlug &&
    (store.artifacts.some((a) => a.qrSlug === qrSlug) ||
      store.events.some((e) => e.qrSlug === qrSlug) ||
      store.venues.some((v) => v.qrSlug === qrSlug))
  ) {
    return res.status(409).json({ error: 'QR slug already in use' });
  }
  const timestamp = now();
  const artifact: Artifact = {
    id: generateId(),
    ownerId: req.user!.id,
    collaborators,
    title,
    kind,
    description,
    mediaUrls,
    sourceRepoUrl,
    supplyClass,
    supplyLimit,
    podProvider,
    priceCents,
    currency,
    visibility,
    reviewsEnabled,
    license,
    qrSlug,
    createdAt: timestamp,
    updatedAt: timestamp,
    supplySold: 0,
  };
  ensureSupplyLimit(artifact);
  store.artifacts.push(artifact);
  return res.status(201).json({ artifact });
});

artifactsRouter.get('/', (req: AuthenticatedRequest, res) => {
  const { ownerId, kind, visibility } = req.query;
  const viewer = req.user?.id;
  const results = store.artifacts.filter((artifact) => {
    if (ownerId && artifact.ownerId !== ownerId) {
      return false;
    }
    if (kind && artifact.kind !== kind) {
      return false;
    }
    if (visibility && artifact.visibility !== visibility) {
      return false;
    }
    return canView(artifact, viewer);
  });
  return res.json({ artifacts: results });
});

artifactsRouter.get('/:id', (req: AuthenticatedRequest, res) => {
  const artifact = store.artifacts.find((a) => a.id === req.params.id);
  if (!artifact || !canView(artifact, req.user?.id)) {
    return res.status(404).json({ error: 'Artifact not found' });
  }
  return res.json({ artifact });
});

artifactsRouter.patch('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const artifact = store.artifacts.find((a) => a.id === req.params.id);
  if (!artifact) {
    return res.status(404).json({ error: 'Artifact not found' });
  }
  if (!canEdit(artifact, req.user!.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const allowed: Array<keyof Artifact> = [
    'title',
    'description',
    'mediaUrls',
    'sourceRepoUrl',
    'supplyClass',
    'supplyLimit',
    'podProvider',
    'priceCents',
    'currency',
    'visibility',
    'reviewsEnabled',
    'license',
    'qrSlug',
    'collaborators',
  ];
  const updates = (req.body ?? {}) as Partial<Artifact>;
  const artifactRecord = artifact as unknown as Record<string, unknown>;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      artifactRecord[key as string] = updates[key];
    }
  }
  artifact.updatedAt = now();
  ensureSupplyLimit(artifact);
  return res.json({ artifact });
});

artifactsRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const index = store.artifacts.findIndex((a) => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Artifact not found' });
  }
  const artifact = store.artifacts[index];
  if (!canEdit(artifact, req.user!.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  store.artifacts.splice(index, 1);
  return res.status(204).send();
});
