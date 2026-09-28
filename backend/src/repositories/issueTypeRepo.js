import { db } from '../db.js';

function attachRules(types) {
  if (!types.length) return types;
  const rules = db
    .prepare('SELECT id, issue_type_id, keyword FROM keyword_rule ORDER BY id')
    .all();
  const grouped = new Map();
  for (const rule of rules) {
    if (!grouped.has(rule.issue_type_id)) grouped.set(rule.issue_type_id, []);
    grouped.get(rule.issue_type_id).push({ id: rule.id, keyword: rule.keyword });
  }
  return types.map((type) => ({ ...type, rules: grouped.get(type.id) || [] }));
}

export function list({ enabled } = {}) {
  const rows =
    enabled === undefined
      ? db.prepare('SELECT id, name, enabled FROM issue_type ORDER BY name COLLATE NOCASE').all()
      : db
          .prepare(
            'SELECT id, name, enabled FROM issue_type WHERE enabled = ? ORDER BY name COLLATE NOCASE',
          )
          .all(enabled ? 1 : 0);
  return attachRules(rows);
}

export function findById(id) {
  const row = db.prepare('SELECT * FROM issue_type WHERE id = ?').get(id);
  if (!row) return undefined;
  return attachRules([row])[0];
}

export function findByName(name) {
  return db.prepare('SELECT * FROM issue_type WHERE name = ? COLLATE NOCASE').get(name);
}

export function create(name) {
  const info = db.prepare('INSERT INTO issue_type (name) VALUES (?)').run(name);
  return findById(info.lastInsertRowid);
}

export function update(id, { name, enabled }) {
  const current = db.prepare('SELECT * FROM issue_type WHERE id = ?').get(id);
  if (!current) return undefined;
  const nextName = name === undefined ? current.name : name;
  const nextEnabled = enabled === undefined ? current.enabled : enabled ? 1 : 0;
  db.prepare(
    "UPDATE issue_type SET name = ?, enabled = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(nextName, nextEnabled, id);
  return findById(id);
}

export function countIssues(id) {
  return db.prepare('SELECT COUNT(*) AS n FROM issue WHERE issue_type_id = ?').get(id).n;
}

export function remove(id) {
  db.prepare('DELETE FROM issue_type WHERE id = ?').run(id);
}

export function addRule(issueTypeId, keyword) {
  const info = db
    .prepare('INSERT INTO keyword_rule (issue_type_id, keyword) VALUES (?, ?)')
    .run(issueTypeId, keyword);
  return db
    .prepare('SELECT id, issue_type_id, keyword FROM keyword_rule WHERE id = ?')
    .get(info.lastInsertRowid);
}

export function findRule(issueTypeId, keyword) {
  return db
    .prepare('SELECT * FROM keyword_rule WHERE issue_type_id = ? AND keyword = ? COLLATE NOCASE')
    .get(issueTypeId, keyword);
}

export function findRuleById(ruleId) {
  return db.prepare('SELECT * FROM keyword_rule WHERE id = ?').get(ruleId);
}

export function removeRule(ruleId) {
  db.prepare('DELETE FROM keyword_rule WHERE id = ?').run(ruleId);
}
