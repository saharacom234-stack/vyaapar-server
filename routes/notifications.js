const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/notifications
// Fetch recent notifications for the logged-in user
router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50); // limit to 50 recent
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/notifications/:id
// Delete a specific notification
router.delete('/:id', async (req, res) => {
  try {
    const notif = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/notifications
// Clear all notifications
router.delete('/', async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });
    res.json({ message: 'All notifications cleared' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
