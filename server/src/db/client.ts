import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import config from '../config.js';

function openDatabase(): Database.Database {
  try {
    mkdirSync(dirname(resolve(config.databasePath)), { recursive: true });
    const db = new Database(config.databasePath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id         TEXT PRIMARY KEY,
        status     TEXT NOT NULL CHECK (status IN ('queued','processing','done','failed')),
        progress   INTEGER NOT NULL DEFAULT 0,
        result     TEXT,
        createdAt  INTEGER NOT NULL
      );
    `);
    return db;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to initialise database at "${config.databasePath}": ${message}`);
    process.exit(1);
  }
}

const db = openDatabase();

export default db;
