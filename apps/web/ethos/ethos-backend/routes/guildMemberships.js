const express = require('express');
const router = express.Router();
const memberships = require('../models/guildMembership');
const { authenticateToken } = require('../auth');
const { pool } = require('../db');

router.use(authenticateToken);

router.post('/', async (req, res) => {
  try {
    const { guild_id, role, user_email, user_id } = req.body;
    let uid = req.user.userId;
    if (user_id) {
      uid = user_id;
    } else if (user_email) {
      const u = await pool.query('SELECT id FROM users WHERE email = $1', [user_email]);
      if (u.rowCount === 0) return res.status(400).json({ error: 'user not found' });
      uid = u.rows[0].id;
    }
    const membership = await memberships.request(guild_id, uid, role);
    res.status(201).json(membership);
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'already requested' });
    } else {
      res.status(500).json({ error: 'failed to request membership' });
    }
  }
});

router.get('/', async (req, res) => {
  const list = await memberships.list(req.query);
  res.json(list);
});

router.post('/:id/approve', async (req, res) => {
  try {
    const membership = await memberships.findById(req.params.id);
    if (!membership) return res.status(404).json({ error: 'not found' });
    const requester = await memberships.get(membership.guild_id, req.user.userId);
    if (!requester || (requester.role !== 'owner' && requester.role !== 'moderator')) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const updated = await memberships.approve(req.params.id, req.body.role || membership.role);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'failed to approve membership' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const membership = await memberships.findById(req.params.id);
    if (!membership) return res.status(404).json({ error: 'not found' });
    if (membership.user_id !== req.user.userId) {
      const requester = await memberships.get(membership.guild_id, req.user.userId);
      if (!requester || requester.role !== 'owner') {
        return res.status(403).json({ error: 'forbidden' });
      }
    }
    await memberships.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'failed to revoke membership' });
  }
});

module.exports = router;
