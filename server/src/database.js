import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

export function createDatabase(databasePath) {
  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  }

  const db = new Database(databasePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      email TEXT UNIQUE,
      password_hash TEXT,
      email_verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS paintings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      image_data BLOB NOT NULL,
      image_mime_type TEXT NOT NULL CHECK (image_mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS paintings_created_at_idx ON paintings(created_at, id);
    CREATE INDEX IF NOT EXISTS paintings_user_id_idx ON paintings(user_id);

    CREATE TABLE IF NOT EXISTS painting_votes (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      painting_id INTEGER NOT NULL REFERENCES paintings(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS painting_votes_painting_id_idx ON painting_votes(painting_id);
  `)

  return db
}
