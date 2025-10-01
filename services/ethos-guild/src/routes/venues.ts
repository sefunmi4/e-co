import { Router } from 'express';

import { requireAuth } from '../auth.js';
import type { AuthenticatedRequest, SellerCatalogItem, Venue } from '../models.js';
import { generateId, now, store } from '../store.js';

export const venuesRouter = Router();

venuesRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const { name, contactEmail, address, qrSlug } = req.body ?? {};
  if (!name || !contactEmail) {
    return res.status(400).json({ error: 'name and contactEmail required' });
  }
  if (
    qrSlug &&
    (store.artifacts.some((a) => a.qrSlug === qrSlug) ||
      store.events.some((e) => e.qrSlug === qrSlug) ||
      store.venues.some((v) => v.qrSlug === qrSlug))
  ) {
    return res.status(409).json({ error: 'QR slug already in use' });
  }
  const venue: Venue = {
    id: generateId(),
    name,
    contactEmail,
    address,
    qrSlug,
    createdAt: now(),
  };
  store.venues.push(venue);
  return res.status(201).json({ venue });
});

venuesRouter.get('/:id', (req, res) => {
  const venue = store.venues.find((v) => v.id === req.params.id);
  if (!venue) {
    return res.status(404).json({ error: 'Venue not found' });
  }
  const catalog = store.sellerCatalog.filter((item) => item.sellerId === venue.id);
  return res.json({ venue, catalog });
});

venuesRouter.post('/:id/catalog', requireAuth, (req: AuthenticatedRequest, res) => {
  const venue = store.venues.find((v) => v.id === req.params.id);
  if (!venue) {
    return res.status(404).json({ error: 'Venue not found' });
  }
  const { artifactId, localInventory = null, priceCents, shippingMode } = req.body ?? {};
  const artifact = store.artifacts.find((a) => a.id === artifactId);
  if (!artifact) {
    return res.status(404).json({ error: 'Artifact not found' });
  }
  if (!priceCents || !shippingMode) {
    return res.status(400).json({ error: 'priceCents and shippingMode required' });
  }
  const catalogItem: SellerCatalogItem = {
    id: generateId(),
    sellerId: venue.id,
    artifactId,
    localInventory: localInventory === null ? null : Number(localInventory),
    priceCents,
    shippingMode,
    createdAt: now(),
  };
  store.sellerCatalog.push(catalogItem);
  return res.status(201).json({ item: catalogItem });
});
