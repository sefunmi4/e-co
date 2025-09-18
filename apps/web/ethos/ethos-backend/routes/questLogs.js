const express = require('express');
const router = express.Router();
const logs = require('../models/questLog');
const { authenticateToken } = require('../auth');

router.use(authenticateToken);

router.post('/', async (req, res) => {
  try {
    const log = await logs.create(req.body);
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: 'failed to create quest log' });
  }
});

router.get('/', async (req, res) => {
  const all = await logs.list();
  res.json(all);
});

router.get('/:id', async (req, res) => {
  const log = await logs.get(req.params.id);
  if (!log) return res.status(404).json({ error: 'not found' });
  res.json(log);
});

router.put('/:id', async (req, res) => {
  const log = await logs.update(req.params.id, req.body);
  res.json(log);
});

router.delete('/:id', async (req, res) => {
  await logs.remove(req.params.id);
  res.status(204).end();
});

module.exports = router;
