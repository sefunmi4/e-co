import { Router } from 'express';

import type { Artifact, CollabAgreement } from '../models.js';
import { store } from '../store.js';

type Ratings = { quality: number; style: number; skillImpact: number };

const averageRatings = (artifactId: string): Ratings | null => {
  const reviews = store.reviews.filter((r) => r.artifactId === artifactId);
  if (reviews.length === 0) {
    return null;
  }
  const totals = reviews.reduce(
    (acc, review) => {
      acc.quality += review.ratingQuality;
      acc.style += review.ratingStyle;
      acc.skill += review.ratingSkillImpact;
      return acc;
    },
    { quality: 0, style: 0, skill: 0 },
  );
  const average: Ratings = {
    quality: totals.quality / reviews.length,
    style: totals.style / reviews.length,
    skillImpact: totals.skill / reviews.length,
  };
  return average;
};

const sortByMetric = (artifacts: Artifact[], metric: keyof Ratings) => {
  return artifacts
    .map((artifact) => ({ artifact, ratings: averageRatings(artifact.id) }))
    .filter((entry): entry is { artifact: Artifact; ratings: Ratings } => entry.ratings !== null)
    .sort((a, b) => (b.ratings[metric] ?? 0) - (a.ratings[metric] ?? 0));
};

const filterCollabs = (collabs: CollabAgreement[]) =>
  collabs.filter((collab) => collab.status === 'ACTIVE' || collab.status === 'DRAFT');

export const discoverRouter = Router();

discoverRouter.get('/', (req, res) => {
  const role = String(req.query.role ?? 'EXPLORER').toUpperCase();
  if (role === 'CLIENT') {
    const results = sortByMetric(store.artifacts, 'quality').slice(0, 10);
    return res.json({ role, artifacts: results });
  }
  if (role === 'EXPLORER') {
    const results = sortByMetric(store.artifacts, 'skillImpact').slice(0, 10);
    return res.json({ role, artifacts: results });
  }
  if (role === 'CREATOR') {
    const collabs = filterCollabs(store.collabs);
    return res.json({ role, collabs, venues: store.venues.slice(0, 10) });
  }
  return res.json({ role, artifacts: store.artifacts.slice(0, 10) });
});
