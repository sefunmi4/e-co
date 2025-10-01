import { Router } from 'express';

import { generateId, now, store } from '../store.js';

export const qrRouter = Router();

const resolveSlug = (slug: string) => {
  const artifact = store.artifacts.find((a) => a.qrSlug === slug);
  if (artifact) {
    return { type: 'ARTIFACT' as const, id: artifact.id, url: `/artifacts/${artifact.id}` };
  }
  const event = store.events.find((e) => e.qrSlug === slug);
  if (event) {
    return { type: 'EVENT' as const, id: event.id, url: `/events/${event.id}` };
  }
  const venue = store.venues.find((v) => v.qrSlug === slug);
  if (venue) {
    return { type: 'VENUE' as const, id: venue.id, url: `/venues/${venue.id}` };
  }
  return null;
};

qrRouter.get('/:slug', (req, res) => {
  const resolution = resolveSlug(req.params.slug);
  if (!resolution) {
    return res.status(404).json({ error: 'QR slug not found' });
  }
  store.qrScans.push({
    id: generateId(),
    slug: req.params.slug,
    entityType: resolution.type,
    entityId: resolution.id,
    scannedAt: now(),
  });
  return res.redirect(302, resolution.url);
});
