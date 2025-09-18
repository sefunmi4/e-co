const express = require('express');
const router = express.Router();
const quests = require('../models/quest');
const memberships = require('../models/guildMembership');
const { authenticateToken } = require('../auth');

router.use(authenticateToken);

router.post('/', async (req, res) => {
  try {
    if (req.body.guild_id) {
      const membership = await memberships.get(req.body.guild_id, req.user.userId);
      if (!membership || membership.status !== 'approved') {
        return res.status(403).json({ error: 'forbidden' });
      }
    }
    const quest = await quests.create({ ...req.body, user_id: req.user.userId });
    res.status(201).json(quest);
  } catch (err) {
    res.status(500).json({ error: 'failed to create quest' });
  }
});

router.get('/', async (req, res) => {
  const all = await quests.list(req.query);
  res.json(all);
});

router.get('/:id', async (req, res) => {
  const quest = await quests.get(req.params.id);
  if (!quest) return res.status(404).json({ error: 'not found' });
  res.json(quest);
});

router.put('/:id', async (req, res) => {
  const quest = await quests.update(req.params.id, req.body);
  res.json(quest);
});

router.delete('/:id', async (req, res) => {
  await quests.remove(req.params.id);
  res.status(204).end();
});

module.exports = router;
