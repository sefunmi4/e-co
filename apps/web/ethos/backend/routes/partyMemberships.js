const express = require('express');
const router = express.Router();
const memberships = require('../models/partyMembership');
const { authenticateToken } = require('../auth');
const { getIo } = require('../socket');

router.use(authenticateToken);

router.post('/', async (req, res) => {
  try {
    const membership = await memberships.join(req.body.party_id, req.user.userId);
    getIo().emit('partyMemberJoined', membership);
    res.status(201).json(membership);
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'already joined' });
    } else {
      res.status(500).json({ error: 'failed to join party' });
    }
  }
});

router.delete('/:party_id', async (req, res) => {
  try {
    const removed = await memberships.leave(req.params.party_id, req.user.userId);
    if (!removed) return res.status(404).json({ error: 'membership not found' });
    getIo().emit('partyMemberLeft', { party_id: parseInt(req.params.party_id), user_id: req.user.userId });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'failed to leave party' });
  }
});

router.post('/:party_id/promote/:user_id', async (req, res) => {
  try {
    const requester = await memberships.get(req.params.party_id, req.user.userId);
    if (!requester || requester.role !== 'moderator') {
      return res.status(403).json({ error: 'forbidden' });
    }
    const updated = await memberships.promote(req.params.party_id, req.params.user_id);
    if (!updated) return res.status(404).json({ error: 'membership not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'failed to promote member' });
  }
});

module.exports = router;
