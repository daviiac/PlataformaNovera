'use strict';

// Banco SQLite embutido do Node (node:sqlite, Node >= 22.13) — sem dependências nativas.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH } = require('./config');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    UNIQUE COLLATE NOCASE,
    username      TEXT    UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    level         TEXT    CHECK (level IN ('A1', 'A2', 'B2')),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    CHECK (email IS NOT NULL OR username IS NOT NULL)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS placement_results (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level      TEXT    NOT NULL CHECK (level IN ('A1', 'A2', 'B2')),
    score      INTEGER NOT NULL,
    max_score  INTEGER NOT NULL,
    details    TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS modules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    track       TEXT    NOT NULL CHECK (track IN ('A1', 'A2', 'B2')),
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (track, title)
  );

  CREATE TABLE IF NOT EXISTS materials (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id     INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title         TEXT    NOT NULL,
    description   TEXT    NOT NULL DEFAULT '',
    original_name TEXT    NOT NULL,
    stored_name   TEXT    NOT NULL UNIQUE,
    mime_type     TEXT    NOT NULL,
    kind          TEXT    NOT NULL,
    size_bytes    INTEGER NOT NULL,
    uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_materials_module ON materials(module_id);
`);

module.exports = db;
