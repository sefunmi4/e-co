const express = require('express');
const router = express.Router();
const comments = require('../models/questComment');
const { authenticateToken } = require('../auth');

router.post('/', authenticateToken, async (req, res) => {
  try {
    const comment = await comments.create({ ...req.body, user_id: req.user.userId });
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: 'failed to create comment' });
  }
});

router.get('/', async (req, res) => {
  const { quest_id, page, limit } = req.query;
  const list = await comments.list({ quest_id, page: Number(page) || 1, limit: limit ? Number(limit) : undefined });
  res.json(list);
});

module.exports = router;
