import { getDb } from '../db/connection.js';
import { log } from '../utils/logger.js';

const MODULE = 'notificationModel';

/**
 * Create a notification for a user.
 * @param {{ id: string, user_id: string, type: string, payload_json: string, created_at: number }} notification
 * @returns {{ ok: boolean, data?: object }}
 */
export function createNotification(notification) {
  const fn = 'createNotification';
  try {
    log.info({ module: MODULE, fn, userId: notification.user_id, type: notification.type }, 'Creating notification');
    getDb()
      .prepare('INSERT INTO notifications (id, user_id, type, payload_json, read, created_at) VALUES (?, ?, ?, ?, 0, ?)')
      .run(notification.id, notification.user_id, notification.type, notification.payload_json, notification.created_at);
    return { ok: true, data: notification };
  } catch (err) {
    log.error({ module: MODULE, fn, userId: notification.user_id, err }, 'Failed to create notification');
    throw err;
  }
}

/**
 * Find all unread notifications for a user.
 * @param {string} userId
 * @returns {{ ok: boolean, data?: object[] }}
 */
export function findUnreadByUserId(userId) {
  const fn = 'findUnreadByUserId';
  try {
    const rows = getDb()
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId);
    return { ok: true, data: rows };
  } catch (err) {
    log.error({ module: MODULE, fn, userId, err }, 'Failed to find notifications');
    throw err;
  }
}

/**
 * Mark a notification as read.
 * @param {string} id
 * @returns {{ ok: boolean }}
 */
export function markRead(id) {
  const fn = 'markRead';
  try {
    getDb().prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
    return { ok: true };
  } catch (err) {
    log.error({ module: MODULE, fn, id, err }, 'Failed to mark notification read');
    throw err;
  }
}
