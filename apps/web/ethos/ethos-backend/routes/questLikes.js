const express = require('express');
const router = express.Router();
const likes = require('../models/questLike');
const { authenticateToken } = require('../auth');

router.post('/', authenticateToken, async (req, res) => {
  try {
    const like = await likes.create({ quest_id: req.body.quest_id, user_id: req.user.userId });
    res.status(201).json(like);
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'already liked' });
    } else {
      res.status(500).json({ error: 'failed to like quest' });
    }
  }
});

router.get('/', async (req, res) => {
  const list = await likes.list(req.query);
  res.json(list);
});

router.delete('/:id', authenticateToken, async (req, res) => {
  await likes.remove(req.params.id, req.user.userId);
  res.status(204).end();
});

module.exports = router;
