const express = require('express');
const router = express.Router();
const bugReports = require('../models/bugReport');
const notifications = require('../models/notification');
const { authenticateToken } = require('../auth');
const { getIo } = require('../socket');

router.use(authenticateToken);

async function notifyStatus(report) {
  const notification = await notifications.create({
    user_id: report.user_id,
    content: `Bug report "${report.title}" status changed to ${report.status}`
  });
  getIo().emit('notification', notification);
}

router.post('/', async (req, res) => {
  try {
    const report = await bugReports.create({
      user_id: req.user.userId,
      title: req.body.title,
      description: req.body.description
    });
    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: 'failed to create bug report' });
  }
});

router.get('/', async (req, res) => {
  const reports = await bugReports.list();
  res.json(reports);
});

router.put('/:id', async (req, res) => {
  try {
    const report = await bugReports.update(req.params.id, req.body);
    if (!report) return res.status(404).json({ error: 'not found' });
    if (req.body.status) {
      await notifyStatus(report);
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'failed to update bug report' });
  }
});

router.post('/:id/close', async (req, res) => {
  try {
    const report = await bugReports.close(req.params.id);
    if (!report) return res.status(404).json({ error: 'not found' });
    await notifyStatus(report);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'failed to close bug report' });
  }
});

module.exports = router;
