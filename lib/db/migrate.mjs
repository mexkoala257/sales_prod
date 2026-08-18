#!/usr/bin/env node
/**
 * Tracked SQL migration runner for the platform database.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node migrate.mjs
 *   pnpm --filter @workspace/db run migrate
 *
 * How it works:
 *   1. Creates a `_migrations` tracking table on first run.
 *   2. Reads all *.sql files from ./migrations/ in filename order.
 *   3. Skips files that have already been recorded in `_migrations`.
 *   4. Runs each pending file in a transaction and records it.
 *
 * All SQL files must be idempotent (use IF NOT EXISTS / DO $$ guards) so that
 * running the file twice is safe even if the tracking table is lost.
 */

import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const __dir = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dir, 'migrations');

const pool = new Pool({ connectionString: DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // Bootstrap the tracking table if it doesn't exist yet.
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id          SERIAL       PRIMARY KEY,
        filename    TEXT         NOT NULL UNIQUE,
        applied_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);

    // Collect and sort migration files (lexicographic order = numbered order).
    let files;
    try {
      files = (await readdir(MIGRATIONS_DIR))
        .filter((f) => f.endsWith('.sql'))
        .sort();
    } catch {
      console.log('No migrations directory found — nothing to apply.');
      return;
    }

    if (files.length === 0) {
      console.log('No migration files found — nothing to apply.');
      return;
    }

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT id FROM _migrations WHERE filename = $1',
        [file],
      );

      if (rows.length > 0) {
        console.log(`[skip]  ${file} — already applied`);
        continue;
      }

      console.log(`[apply] ${file} …`);
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf-8');

      // Run in a transaction so a partial failure doesn't corrupt the DB.
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)',
          [file],
        );
        await client.query('COMMIT');
        console.log(`[done]  ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('All migrations applied successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
