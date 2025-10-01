import type { CollabSplit } from '../models.js';

export const computePayouts = (
  totalCents: number,
  platformFeePct: number,
  splits: CollabSplit[],
) => {
  const fee = Math.round((platformFeePct / 100) * totalCents);
  const distributable = totalCents - fee;
  const payouts = splits.map((split) => ({
    recipientId: split.userId,
    amountCents: Math.round((split.percent / 100) * distributable),
  }));
  const diff = distributable - payouts.reduce((sum, payout) => sum + payout.amountCents, 0);
  if (diff !== 0 && payouts.length > 0) {
    let maxIndex = 0;
    payouts.forEach((payout, index) => {
      if (payout.amountCents > payouts[maxIndex].amountCents) {
        maxIndex = index;
      }
    });
    payouts[maxIndex].amountCents += diff;
  }
  return { feeCents: fee, payouts };
};
