import { Router } from 'express';

import type { AuthenticatedRequest } from '../models.js';
import { requireAuth } from '../auth.js';
import { generateId, now, store } from '../store.js';

const validateRating = (value: unknown) => typeof value === 'number' && value >= 1 && value <= 5;

export const reviewsRouter = Router({ mergeParams: true });

reviewsRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const artifact = store.artifacts.find((a) => a.id === req.params.id);
  if (!artifact) {
    return res.status(404).json({ error: 'Artifact not found' });
  }
  if (!artifact.reviewsEnabled) {
    return res.status(400).json({ error: 'Reviews disabled for this artifact' });
  }
  if (artifact.ownerId === req.user!.id) {
    return res.status(400).json({ error: 'Owners cannot review their own artifacts' });
  }
  const { ratingQuality, ratingStyle, ratingSkillImpact, comment, tags } = req.body ?? {};
  if (
    !validateRating(ratingQuality) ||
    !validateRating(ratingStyle) ||
    !validateRating(ratingSkillImpact)
  ) {
    return res.status(400).json({ error: 'Ratings must be between 1 and 5' });
  }
  const review = {
    id: generateId(),
    artifactId: artifact.id,
    reviewerId: req.user!.id,
    ratingQuality,
    ratingStyle,
    ratingSkillImpact,
    comment,
    tags,
    createdAt: now(),
  };
  store.reviews.push(review);
  return res.status(201).json({ review });
});

reviewsRouter.get('/', (req: AuthenticatedRequest, res) => {
  const artifact = store.artifacts.find((a) => a.id === req.params.id);
  if (!artifact) {
    return res.status(404).json({ error: 'Artifact not found' });
  }
  const reviews = store.reviews.filter((r) => r.artifactId === artifact.id);
  return res.json({ reviews });
});

reviewsRouter.get('/summary', (req: AuthenticatedRequest, res) => {
  const artifact = store.artifacts.find((a) => a.id === req.params.id);
  if (!artifact) {
    return res.status(404).json({ error: 'Artifact not found' });
  }
  const reviews = store.reviews.filter((r) => r.artifactId === artifact.id);
  if (reviews.length === 0) {
    return res.json({ average: null, tags: [] });
  }
  const aggregate = reviews.reduce(
    (acc, review) => {
      acc.quality += review.ratingQuality;
      acc.style += review.ratingStyle;
      acc.skill += review.ratingSkillImpact;
      if (review.tags) {
        review.tags.forEach((tag) => acc.tags.add(tag));
      }
      return acc;
    },
    { quality: 0, style: 0, skill: 0, tags: new Set<string>() },
  );
  const average = {
    quality: aggregate.quality / reviews.length,
    style: aggregate.style / reviews.length,
    skillImpact: aggregate.skill / reviews.length,
  };
  return res.json({ average, tags: Array.from(aggregate.tags) });
});
