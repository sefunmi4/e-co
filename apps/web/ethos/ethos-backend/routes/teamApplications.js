const express = require('express');
const router = express.Router();
const teamApps = require('../models/teamApplication');
const { authenticateToken } = require('../auth');

router.use(authenticateToken);

router.post('/', async (req, res) => {
  try {
    const app = await teamApps.create({ ...req.body, user_id: req.user.userId });
    res.status(201).json(app);
  } catch (err) {
    res.status(500).json({ error: 'failed to submit application' });
  }
});

router.get('/', async (req, res) => {
  try {
    const apps = await teamApps.list(req.query);
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: 'failed to fetch applications' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const app = await teamApps.update(req.params.id, req.body);
    res.json(app);
  } catch (err) {
    res.status(500).json({ error: 'failed to update application' });
  }
});

module.exports = router;
