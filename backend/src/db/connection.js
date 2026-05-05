import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from '../config/env.js';
import { log } from '../utils/logger.js';

const dbPath = resolve(env.DB_PATH);
mkdirSync(dirname(dbPath), { recursive: true });

let _db;

/**
 * Return the singleton DatabaseSync instance with a better-sqlite3-compatible shim.
 * Adds .pragma() and .transaction() so the rest of the codebase stays unchanged.
 * @returns {DatabaseSync & { pragma(s:string): void, transaction(fn:Function): Function }}
 */
export function getDb() {
  if (_db) return _db;

  const raw = new DatabaseSync(dbPath);

  // Enable WAL and foreign keys via PRAGMA
  raw.exec('PRAGMA journal_mode = WAL');
  raw.exec('PRAGMA foreign_keys = ON');

  // Shim: db.pragma(str) — accepts "key = value" or "key"
  raw.pragma = (str) => {
    raw.exec(`PRAGMA ${str}`);
  };

  // Shim: db.transaction(fn) — returns a function that wraps fn in BEGIN/COMMIT/ROLLBACK
  raw.transaction = (fn) => {
    return (...args) => {
      raw.exec('BEGIN');
      try {
        const result = fn(...args);
        raw.exec('COMMIT');
        return result;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    };
  };

  _db = raw;
  log.info({ dbPath }, 'SQLite connection opened (node:sqlite)');
  return _db;
}
