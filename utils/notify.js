const Notification = require('../models/Notification');

/**
 * Creates a persistent notification for a user.
 * @param {ObjectId|string} userId - The user to receive the notification
 * @param {string} title - The notification title
 * @param {string} message - The notification message/description
 * @param {string} type - 'info', 'success', 'warning', or 'danger'
 * @param {string} iconType - Lucide icon name (e.g., 'FileText', 'Package', 'User')
 */
const notify = async (userId, title, message, type = 'info', iconType = 'Bell') => {
  try {
    await Notification.create({
      user: userId,
      title,
      message,
      type,
      iconType
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

module.exports = { notify };
