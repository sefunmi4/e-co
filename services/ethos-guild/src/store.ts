import { randomUUID } from 'crypto';

import type {
  Artifact,
  CollabAgreement,
  Event,
  Order,
  Payout,
  QRScan,
  Review,
  SellerCatalogItem,
  Ticket,
  User,
  Venue,
} from './models.js';

export interface DataStore {
  users: User[];
  artifacts: Artifact[];
  collabs: CollabAgreement[];
  reviews: Review[];
  events: Event[];
  tickets: Ticket[];
  orders: Order[];
  payouts: Payout[];
  venues: Venue[];
  sellerCatalog: SellerCatalogItem[];
  qrScans: QRScan[];
}

export const store: DataStore = {
  users: [],
  artifacts: [],
  collabs: [],
  reviews: [],
  events: [],
  tickets: [],
  orders: [],
  payouts: [],
  venues: [],
  sellerCatalog: [],
  qrScans: [],
};

export const now = () => new Date().toISOString();

export const generateId = () => randomUUID();

export const resetStore = () => {
  store.users.length = 0;
  store.artifacts.length = 0;
  store.collabs.length = 0;
  store.reviews.length = 0;
  store.events.length = 0;
  store.tickets.length = 0;
  store.orders.length = 0;
  store.payouts.length = 0;
  store.venues.length = 0;
  store.sellerCatalog.length = 0;
  store.qrScans.length = 0;
};
