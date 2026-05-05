import { getDb } from '../db/connection.js';
import { log } from '../utils/logger.js';

const MODULE = 'userModel';

/**
 * Find a user by email.
 * @param {string} email
 * @returns {{ ok: boolean, data?: object, error?: string }}
 */
export function findByEmail(email) {
  const fn = 'findByEmail';
  try {
    log.info({ module: MODULE, fn, email }, 'Finding user by email');
    const user = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
    return { ok: true, data: user || null };
  } catch (err) {
    log.error({ module: MODULE, fn, email, err }, 'Failed to find user by email');
    throw err;
  }
}

/**
 * Find a user by ID.
 * @param {string} id
 * @returns {{ ok: boolean, data?: object, error?: string }}
 */
export function findById(id) {
  const fn = 'findById';
  try {
    log.info({ module: MODULE, fn, id }, 'Finding user by id');
    const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
    return { ok: true, data: user || null };
  } catch (err) {
    log.error({ module: MODULE, fn, id, err }, 'Failed to find user by id');
    throw err;
  }
}

/**
 * Insert a new user record.
 * @param {{ id: string, email: string, password_hash: string, role: string, name: string, created_at: number }} user
 * @returns {{ ok: boolean, data?: object, error?: string }}
 */
export function createUser(user) {
  const fn = 'createUser';
  try {
    log.info({ module: MODULE, fn, email: user.email, role: user.role }, 'Creating user');
    getDb()
      .prepare(
        'INSERT INTO users (id, email, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(user.id, user.email, user.password_hash, user.role, user.name, user.created_at);
    return { ok: true, data: user };
  } catch (err) {
    log.error({ module: MODULE, fn, email: user.email, err }, 'Failed to create user');
    throw err;
  }
}
