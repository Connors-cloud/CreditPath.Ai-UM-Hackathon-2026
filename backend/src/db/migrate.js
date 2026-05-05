import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDb } from './connection.js';
import { log } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Run schema.sql against the DB (CREATE TABLE IF NOT EXISTS â idempotent).
 * @returns {void}
 */
export function runMigrations() {
  const db = getDb();
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  try {
    db.exec(sql);
    log.info('Database migrations applied successfully');
  } catch (err) {
    log.error({ err }, 'Failed to run migrations');
    throw err;
  }
}
