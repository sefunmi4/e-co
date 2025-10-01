import type { Request } from 'express';

export type Role = 'EXPLORER' | 'CREATOR' | 'CLIENT' | 'PRODUCER';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  roles: Role[];
  country?: string;
  dateOfBirth?: string;
  isOfAge: boolean;
  bio?: string;
  socials?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileMetrics {
  followers: number;
  following: number;
  artifactCount: number;
  avgReviewScore?: number;
  skillTags: string[];
}

export type ArtifactKind =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'CODE'
  | 'MODEL3D'
  | 'PHYSICAL';
export type SupplyClass = 'COMMON' | 'RARE' | 'LIMITED';

export interface Artifact {
  id: string;
  ownerId: string;
  collaborators?: string[];
  title: string;
  kind: ArtifactKind;
  description?: string;
  mediaUrls?: string[];
  sourceRepoUrl?: string;
  supplyClass: SupplyClass;
  supplyLimit?: number;
  podProvider?: 'PRINTFUL' | 'PRINTIFY' | 'NONE';
  priceCents?: number;
  currency?: string;
  visibility: 'PRIVATE' | 'PUBLIC' | 'FRIENDS' | 'UNLISTED';
  reviewsEnabled: boolean;
  license?: 'CC-BY' | 'CC-BY-NC' | 'PROPRIETARY';
  qrSlug?: string;
  createdAt: string;
  updatedAt: string;
  supplySold?: number;
}

export interface CollabSplit {
  userId: string;
  percent: number;
}

export interface CollabAgreement {
  id: string;
  artifactId: string;
  splits: CollabSplit[];
  termsUrl?: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  artifactId: string;
  reviewerId: string;
  ratingQuality: number;
  ratingStyle: number;
  ratingSkillImpact: number;
  comment?: string;
  tags?: string[];
  createdAt: string;
}

export interface Event {
  id: string;
  organizerId: string;
  title: string;
  description?: string;
  venueId?: string;
  startTime: string;
  endTime: string;
  ticketPriceCents?: number;
  capacity?: number;
  qrSlug?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  eventId: string;
  buyerId: string;
  status: 'VALID' | 'USED' | 'REFUNDED';
  qrCode: string;
  createdAt: string;
}

export interface OrderItem {
  artifactId: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Order {
  id: string;
  buyerId: string;
  items: OrderItem[];
  subtotalCents: number;
  feesCents: number;
  totalCents: number;
  paymentIntentId?: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';
  createdAt: string;
}

export interface Payout {
  id: string;
  orderId: string;
  recipientId: string;
  amountCents: number;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  createdAt: string;
}

export interface Venue {
  id: string;
  name: string;
  contactEmail: string;
  address?: string;
  qrSlug?: string;
  createdAt: string;
}

export interface SellerCatalogItem {
  id: string;
  sellerId: string;
  artifactId: string;
  localInventory: number | null;
  priceCents: number;
  shippingMode: 'SELF_SHIP' | 'POD';
  createdAt: string;
}

export interface QRScan {
  id: string;
  slug: string;
  entityType: 'ARTIFACT' | 'EVENT' | 'VENUE';
  entityId: string;
  scannedAt: string;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}
