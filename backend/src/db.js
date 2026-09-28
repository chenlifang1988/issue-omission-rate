import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DB_DIR || path.join(currentDir, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = process.env.DB_PATH || path.join(dataDir, 'omission.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS issue_type (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS keyword_rule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_type_id INTEGER NOT NULL REFERENCES issue_type(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (issue_type_id, keyword)
);

CREATE TABLE IF NOT EXISTS missed_type_note (
  issue_type_id INTEGER PRIMARY KEY REFERENCES issue_type(id) ON DELETE CASCADE,
  cause TEXT,
  action TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS issue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL CHECK (source IN ('test', 'client')),
  raw_description TEXT NOT NULL,
  raw_classification TEXT,
  issue_type_id INTEGER REFERENCES issue_type(id),
  matched_keyword TEXT,
  classification_status TEXT NOT NULL DEFAULT 'pending' CHECK (classification_status IN ('auto', 'manual', 'pending')),
  module TEXT,
  occurred_date TEXT,
  import_batch TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_issue_source ON issue(source);
CREATE INDEX IF NOT EXISTS idx_issue_type ON issue(issue_type_id);
CREATE INDEX IF NOT EXISTS idx_issue_status ON issue(classification_status);
CREATE INDEX IF NOT EXISTS idx_issue_date ON issue(occurred_date);
CREATE INDEX IF NOT EXISTS idx_rule_type ON keyword_rule(issue_type_id);
`);

const issueColumns = db.prepare('PRAGMA table_info(issue)').all().map((column) => column.name);
if (!issueColumns.includes('raw_classification')) {
  db.exec('ALTER TABLE issue ADD COLUMN raw_classification TEXT');
  db.prepare(
    `UPDATE issue
     SET raw_classification = matched_keyword
     WHERE raw_classification IS NULL AND matched_keyword IS NOT NULL`,
  ).run();
}

export default db;
