import { Router } from 'express';
import QRCode from 'qrcode';

import { requireAuth, requireOfAge } from '../auth.js';
import type { AuthenticatedRequest, Event, Ticket } from '../models.js';
import { generateId, now, store } from '../store.js';

const ensureQrAvailable = (qrSlug?: string) => {
  if (!qrSlug) {
    return true;
  }
  const conflict =
    store.artifacts.some((a) => a.qrSlug === qrSlug) ||
    store.events.some((e) => e.qrSlug === qrSlug) ||
    store.venues.some((v) => v.qrSlug === qrSlug);
  return !conflict;
};

const generateTicketQr = async (ticketId: string) => {
  return QRCode.toDataURL(ticketId);
};

export const eventsRouter = Router();

eventsRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const { title, description, venueId, startTime, endTime, ticketPriceCents, capacity, qrSlug } =
    req.body ?? {};
  if (!title || !startTime || !endTime) {
    return res.status(400).json({ error: 'title, startTime, and endTime are required' });
  }
  if (!ensureQrAvailable(qrSlug)) {
    return res.status(409).json({ error: 'QR slug already in use' });
  }
  const timestamp = now();
  const event: Event = {
    id: generateId(),
    organizerId: req.user!.id,
    title,
    description,
    venueId,
    startTime,
    endTime,
    ticketPriceCents,
    capacity,
    qrSlug,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.events.push(event);
  return res.status(201).json({ event });
});

eventsRouter.get('/', (req: AuthenticatedRequest, res) => {
  const { organizerId } = req.query;
  const events = store.events.filter((event) =>
    organizerId ? event.organizerId === organizerId : true,
  );
  return res.json({ events });
});

eventsRouter.get('/:id', (req, res) => {
  const event = store.events.find((e) => e.id === req.params.id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  const tickets = store.tickets.filter((ticket) => ticket.eventId === event.id);
  return res.json({ event, tickets });
});

eventsRouter.post('/:id/tickets', requireAuth, requireOfAge, async (
  req: AuthenticatedRequest,
  res,
) => {
  const event = store.events.find((e) => e.id === req.params.id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  if (!event.ticketPriceCents) {
    return res.status(400).json({ error: 'Tickets for this event are not on sale' });
  }
  const quantity = Number(req.body?.quantity ?? 1);
  if (Number.isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'quantity must be greater than zero' });
  }
  if (event.capacity !== undefined) {
    const sold = store.tickets.filter((t) => t.eventId === event.id && t.status !== 'REFUNDED')
      .length;
    if (sold + quantity > event.capacity) {
      return res.status(400).json({ error: 'Event is sold out' });
    }
  }
  const createdTickets: Ticket[] = [];
  for (let i = 0; i < quantity; i += 1) {
    const ticketId = generateId();
    const ticket: Ticket = {
      id: ticketId,
      eventId: event.id,
      buyerId: req.user!.id,
      status: 'VALID',
      qrCode: await generateTicketQr(ticketId),
      createdAt: now(),
    };
    store.tickets.push(ticket);
    createdTickets.push(ticket);
  }
  return res.status(201).json({ tickets: createdTickets });
});

eventsRouter.post('/:id/scan', async (req, res) => {
  const event = store.events.find((e) => e.id === req.params.id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  const { qrCode } = req.body ?? {};
  if (!qrCode) {
    return res.status(400).json({ error: 'qrCode required' });
  }
  const ticket = store.tickets.find((t) => t.eventId === event.id && t.qrCode === qrCode);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  if (ticket.status === 'USED') {
    return res.status(400).json({ error: 'Ticket already used' });
  }
  ticket.status = 'USED';
  return res.json({ ticket });
});
