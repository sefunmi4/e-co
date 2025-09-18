const express = require('express');
const router = express.Router();
const guilds = require('../models/guild');
const { authenticateToken } = require('../auth');

router.use(authenticateToken);

router.post('/', async (req, res) => {
  try {
    const guild = await guilds.create(req.body);
    res.status(201).json(guild);
  } catch (err) {
    res.status(500).json({ error: 'failed to create guild' });
  }
});

router.get('/', async (req, res) => {
  const all = await guilds.list();
  res.json(all);
});

router.get('/:id', async (req, res) => {
  const guild = await guilds.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'not found' });
  res.json(guild);
});

router.put('/:id', async (req, res) => {
  const guild = await guilds.update(req.params.id, req.body);
  res.json(guild);
});

router.delete('/:id', async (req, res) => {
  await guilds.remove(req.params.id);
  res.status(204).end();
});

module.exports = router;
