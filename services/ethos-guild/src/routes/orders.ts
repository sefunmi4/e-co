import { Router } from 'express';

import { requireAuth, requireOfAge } from '../auth.js';
import type { AuthenticatedRequest, Order, Payout } from '../models.js';
import { computePayouts } from '../utils/payouts.js';
import { config } from '../config.js';
import { generateId, now, store } from '../store.js';
import { queueOnChainReceipt } from '../contracts/smartContract.js';

const createPaymentIntent = (amount: number) => {
  const id = `pi_${generateId()}`;
  return {
    id,
    clientSecret: `${id}_secret`,
    amount,
    currency: 'usd',
    status: 'requires_payment_method',
  } as const;
};

export const ordersRouter = Router();

ordersRouter.post('/', requireAuth, requireOfAge, (req: AuthenticatedRequest, res) => {
  const { items } = req.body ?? {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order items required' });
  }
  const orderItems = [] as Order['items'];
  let subtotal = 0;
  for (const item of items) {
    const artifact = store.artifacts.find((a) => a.id === item.artifactId);
    if (!artifact) {
      return res.status(404).json({ error: `Artifact ${item.artifactId} not found` });
    }
    if (!artifact.priceCents) {
      return res.status(400).json({ error: `Artifact ${artifact.id} is not for sale` });
    }
    const quantity = Number(item.quantity ?? 1);
    if (Number.isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than zero' });
    }
    if (artifact.supplyClass !== 'COMMON' && artifact.supplyLimit !== undefined) {
      const remaining = (artifact.supplyLimit ?? 0) - (artifact.supplySold ?? 0);
      if (remaining < quantity) {
        return res.status(400).json({ error: `Artifact ${artifact.id} is sold out` });
      }
    }
    const unitPrice = artifact.priceCents;
    orderItems.push({ artifactId: artifact.id, quantity, unitPriceCents: unitPrice });
    subtotal += unitPrice * quantity;
  }
  const estimatedFees = Math.round((config.platformFeePercent / 100) * subtotal);
  const paymentIntent = createPaymentIntent(subtotal + estimatedFees);
  const order: Order = {
    id: generateId(),
    buyerId: req.user!.id,
    items: orderItems,
    subtotalCents: subtotal,
    feesCents: estimatedFees,
    totalCents: subtotal + estimatedFees,
    paymentIntentId: paymentIntent.id,
    status: 'PENDING',
    createdAt: now(),
  };
  store.orders.push(order);
  return res.status(201).json({ order, paymentIntent });
});

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post('/stripe', (req, res) => {
  const { type, data } = req.body ?? {};
  if (type !== 'payment_intent.succeeded') {
    return res.status(202).json({ received: true });
  }
  const paymentIntentId = data?.object?.id;
  if (!paymentIntentId) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const order = store.orders.find((o) => o.paymentIntentId === paymentIntentId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  if (order.status === 'PAID') {
    return res.json({ order });
  }
  const payoutAccumulator = new Map<string, number>();
  let totalFees = 0;
  for (const item of order.items) {
    const artifact = store.artifacts.find((a) => a.id === item.artifactId);
    if (!artifact) {
      continue;
    }
    const collab = store.collabs.find(
      (c) => c.artifactId === artifact.id && c.status === 'ACTIVE',
    );
    const splits = collab?.splits ?? [{ userId: artifact.ownerId, percent: 100 }];
    const { feeCents, payouts } = computePayouts(
      item.unitPriceCents * item.quantity,
      config.platformFeePercent,
      splits,
    );
    totalFees += feeCents;
    payouts.forEach((payout) => {
      payoutAccumulator.set(
        payout.recipientId,
        (payoutAccumulator.get(payout.recipientId) ?? 0) + payout.amountCents,
      );
    });
    if (artifact.supplyClass !== 'COMMON') {
      artifact.supplySold = (artifact.supplySold ?? 0) + item.quantity;
      if (artifact.supplyLimit !== undefined && artifact.supplySold > artifact.supplyLimit) {
        artifact.supplySold = artifact.supplyLimit;
      }
    }
  }
  order.status = 'PAID';
  order.feesCents = totalFees;
  order.totalCents = order.subtotalCents + order.feesCents;
  const payouts: Payout[] = [];
  payoutAccumulator.forEach((amount, recipientId) => {
    const payout: Payout = {
      id: generateId(),
      orderId: order.id,
      recipientId,
      amountCents: amount,
      status: 'QUEUED',
      createdAt: now(),
    };
    store.payouts.push(payout);
    payouts.push(payout);
  });
  queueOnChainReceipt(order.id).catch((err) => {
    console.warn('Failed to queue on-chain receipt', err);
  });
  return res.json({ order, payouts });
});
