import { db } from '../db.js';

export function findByTypeId(issueTypeId) {
  return db
    .prepare('SELECT issue_type_id, cause, action, updated_at FROM missed_type_note WHERE issue_type_id = ?')
    .get(issueTypeId);
}

export function findByTypeIds(issueTypeIds = []) {
  if (!issueTypeIds.length) return new Map();
  const placeholders = issueTypeIds.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT issue_type_id, cause, action, updated_at
       FROM missed_type_note
       WHERE issue_type_id IN (${placeholders})`,
    )
    .all(...issueTypeIds);
  return new Map(rows.map((row) => [row.issue_type_id, row]));
}

export function upsert(issueTypeId, { cause = '', action = '' } = {}) {
  db.prepare(
    `INSERT INTO missed_type_note (issue_type_id, cause, action, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(issue_type_id) DO UPDATE SET
       cause = excluded.cause,
       action = excluded.action,
       updated_at = datetime('now')`,
  ).run(issueTypeId, String(cause ?? ''), String(action ?? ''));
  return findByTypeId(issueTypeId);
}
