import { log } from '../utils/logger.js';
import { getDb } from '../db/connection.js';
import { newId } from '../utils/ids.js';

const MODULE = 'followupService';
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Check for applications with no student activity in 5+ days and mark them abandoned.
 * Called once per day via setInterval.
 */
export function checkAbandonedApplications() {
  const fn = 'checkAbandonedApplications';
  try {
    const db = getDb();
    const cutoff = Date.now() - FIVE_DAYS_MS;
    const stale = db.prepare(
      `SELECT * FROM applications WHERE status = 'submitted' AND last_student_activity_at < ?`
    ).all(cutoff);

    if (!stale.length) return;

    log.info({ module: MODULE, fn, count: stale.length }, 'Marking stale applications as abandoned');
    const now = Date.now();

    for (const app of stale) {
      db.prepare(`UPDATE applications SET status = 'abandoned', last_updated_at = ? WHERE id = ?`).run(now, app.id);
      db.prepare(`INSERT INTO notifications (id, user_id, type, payload_json, read, created_at) VALUES (?, ?, ?, ?, 0, ?)`)
        .run(newId(), app.student_id, 'followup_reminder',
          JSON.stringify({ application_id: app.id, message: 'Your application has been marked as abandoned due to inactivity.' }),
          now);
    }
  } catch (err) {
    log.error({ module: MODULE, fn, err }, 'Failed to check abandoned applications');
  }
}

/**
 * Start the daily abandonment check scheduler.
 */
export function startFollowupScheduler() {
  const DAILY = 24 * 60 * 60 * 1000;
  log.info({ module: MODULE }, 'Starting followup scheduler (runs daily)');
  setInterval(checkAbandonedApplications, DAILY);
  // Run once on startup too
  checkAbandonedApplications();
}
