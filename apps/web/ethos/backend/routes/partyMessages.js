const express = require('express');
const router = express.Router();
const messages = require('../models/partyMessage');
const memberships = require('../models/partyMembership');
const { authenticateToken } = require('../auth');
const { getIo } = require('../socket');

router.use(authenticateToken);

router.post('/', async (req, res) => {
  try {
    const msg = await messages.create({
      party_id: req.body.party_id,
      user_id: req.user.userId,
      message: req.body.message
    });
    getIo().emit('partyMessage', msg);
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: 'failed to create party message' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const msg = await messages.get(req.params.id);
    if (!msg) return res.status(404).json({ error: 'not found' });
    const member = await memberships.get(msg.party_id, req.user.userId);
    if (!member || member.role !== 'moderator') {
      return res.status(403).json({ error: 'forbidden' });
    }
    const updated = await messages.update(req.params.id, { message: req.body.message });
    getIo().emit('partyMessageUpdated', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'failed to update party message' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const msg = await messages.get(req.params.id);
    if (!msg) return res.status(404).json({ error: 'not found' });
    const member = await memberships.get(msg.party_id, req.user.userId);
    if (!member || member.role !== 'moderator') {
      return res.status(403).json({ error: 'forbidden' });
    }
    await messages.remove(req.params.id);
    getIo().emit('partyMessageDeleted', { id: parseInt(req.params.id), party_id: msg.party_id });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'failed to delete party message' });
  }
});

module.exports = router;
