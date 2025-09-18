const express = require('express');
const router = express.Router();
const notifications = require('../models/notification');
const { authenticateToken } = require('../auth');
const { getIo } = require('../socket');

router.use(authenticateToken);

router.post('/', async (req, res) => {
  try {
    const notification = await notifications.create({
      user_id: req.user.userId,
      content: req.body.content
    });
    getIo().emit('notification', notification);
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ error: 'failed to create notification' });
  }
});

module.exports = router;
