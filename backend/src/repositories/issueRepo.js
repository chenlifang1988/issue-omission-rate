import { db } from '../db.js';

function buildFilters(filters = {}) {
  const where = [];
  const params = [];
  if (filters.source) {
    where.push('i.source = ?');
    params.push(filters.source);
  }
  if (filters.issueTypeId) {
    where.push('i.issue_type_id = ?');
    params.push(filters.issueTypeId);
  }
  if (filters.status) {
    where.push('i.classification_status = ?');
    params.push(filters.status);
  }
  if (filters.module === '__none__') {
    where.push("(i.module IS NULL OR i.module = '')");
  } else if (filters.module) {
    where.push('i.module = ?');
    params.push(filters.module);
  }
  if (filters.startDate) {
    where.push('i.occurred_date >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    where.push('i.occurred_date <= ?');
    params.push(filters.endDate);
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export function list(filters = {}) {
  const { clause, params } = buildFilters(filters);
  const limit = Number(filters.limit) > 0 ? Number(filters.limit) : 500;
  return db
    .prepare(
      `SELECT i.id, i.source, i.raw_description, i.issue_type_id, i.matched_keyword,
              i.classification_status, i.module, i.occurred_date, i.import_batch,
              i.created_at, i.updated_at, t.name AS issue_type_name
       FROM issue i
       LEFT JOIN issue_type t ON t.id = i.issue_type_id
       ${clause}
       ORDER BY i.classification_status = 'pending' DESC, i.occurred_date DESC, i.id DESC
       LIMIT ${limit}`,
    )
    .all(...params);
}

export function statsRecords(filters = {}) {
  const { clause, params } = buildFilters(filters);
  const scope = clause ? `${clause} AND i.classification_status <> 'pending'` : "WHERE i.classification_status <> 'pending'";
  return db
    .prepare(`SELECT i.source, i.issue_type_id FROM issue i ${scope}`)
    .all(...params);
}

export function pendingCount(filters = {}) {
  const { clause, params } = buildFilters({ ...filters, status: undefined });
  const scope = clause ? `${clause} AND i.classification_status = 'pending'` : "WHERE i.classification_status = 'pending'";
  return db.prepare(`SELECT COUNT(*) AS n FROM issue i ${scope}`).get(...params).n;
}

export function countRawClassifications(filters = {}) {
  const { clause, params } = buildFilters({ ...filters, source: undefined, status: undefined });
  const condition = "i.source = 'client' AND i.raw_classification IS NOT NULL AND TRIM(i.raw_classification) <> ''";
  const scope = clause ? `${clause} AND ${condition}` : `WHERE ${condition}`;
  return db
    .prepare(`SELECT COUNT(DISTINCT TRIM(i.raw_classification)) AS n FROM issue i ${scope}`)
    .get(...params).n;
}

export function typeStats(typeIds, filters = {}) {
  if (!typeIds.length) return [];
  const { clause, params } = buildFilters({ ...filters, source: 'client', status: undefined });
  const placeholders = typeIds.map(() => '?').join(', ');
  const condition = `i.issue_type_id IN (${placeholders})`;
  const scope = clause ? `${clause} AND ${condition}` : `WHERE ${condition}`;
  const rows = db
    .prepare(`SELECT i.issue_type_id, i.raw_description FROM issue i ${scope} ORDER BY i.issue_type_id, i.id`)
    .all(...params, ...typeIds);
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.issue_type_id)) {
      grouped.set(row.issue_type_id, { issue_type_id: row.issue_type_id, record_count: 0, samples: [] });
    }
    const entry = grouped.get(row.issue_type_id);
    entry.record_count += 1;
    if (entry.samples.length < 3) entry.samples.push(row.raw_description);
  }
  return typeIds.map(
    (id) => grouped.get(id) || { issue_type_id: id, record_count: 0, samples: [] },
  );
}

export function summary() {
  const rows = db
    .prepare(
      `SELECT source,
              COUNT(*) AS total,
              SUM(CASE WHEN classification_status = 'pending' THEN 1 ELSE 0 END) AS pending
       FROM issue GROUP BY source`,
    )
    .all();
  const result = {
    client: { total: 0, pending: 0 },
    test: { total: 0, pending: 0 },
  };
  for (const row of rows) {
    result[row.source] = { total: row.total, pending: row.pending || 0 };
  }
  return result;
}

export function findById(id) {
  return db
    .prepare(
      `SELECT i.*, t.name AS issue_type_name
       FROM issue i LEFT JOIN issue_type t ON t.id = i.issue_type_id
       WHERE i.id = ?`,
    )
    .get(id);
}

export function updateClassification(id, { issue_type_id, matched_keyword, classification_status }) {
  db.prepare(
    `UPDATE issue
     SET issue_type_id = ?, matched_keyword = ?, classification_status = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(issue_type_id, matched_keyword ?? null, classification_status, id);
  return findById(id);
}

export function pendingRecords() {
  return db
    .prepare("SELECT id, raw_description FROM issue WHERE classification_status = 'pending'")
    .all();
}

export function remove(id) {
  db.prepare('DELETE FROM issue WHERE id = ?').run(id);
}

export function removeBySource(source) {
  return db.prepare('DELETE FROM issue WHERE source = ?').run(source).changes;
}

export function removeBySourceAndModules(source, modules = []) {
  const values = [...new Set(modules.map((value) => (typeof value === 'string' ? value.trim() : '')))];
  const named = values.filter((value) => value !== '');
  const conditions = [];
  const params = [source];
  if (named.length) {
    conditions.push(`module IN (${named.map(() => '?').join(', ')})`);
    params.push(...named);
  }
  if (values.includes('')) {
    conditions.push("(module IS NULL OR module = '')");
  }
  if (!conditions.length) return 0;
  return db
    .prepare(`DELETE FROM issue WHERE source = ? AND (${conditions.join(' OR ')})`)
    .run(...params).changes;
}

export function createMany(rows) {
  const insert = db.prepare(
    `INSERT INTO issue (source, raw_description, raw_classification, issue_type_id, matched_keyword,
                        classification_status, module, occurred_date, import_batch)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertAll = db.transaction((items) => {
    const ids = [];
    for (const item of items) {
      const info = insert.run(
        item.source,
        item.raw_description,
        item.raw_classification ?? null,
        item.issue_type_id ?? null,
        item.matched_keyword ?? null,
        item.classification_status,
        item.module ?? null,
        item.occurred_date ?? null,
        item.import_batch ?? null,
      );
      ids.push(info.lastInsertRowid);
    }
    return ids;
  });
  return insertAll(rows);
}

export function listModules() {
  return db
    .prepare(
      "SELECT DISTINCT module FROM issue WHERE module IS NOT NULL AND module <> '' ORDER BY module COLLATE NOCASE",
    )
    .all()
    .map((row) => row.module);
}

export function renameModule(from, to) {
  const target = String(to ?? '').trim();
  if (!target) return 0;
  const source = typeof from === 'string' ? from.trim() : '';
  if (source === '') {
    return db
      .prepare(
        "UPDATE issue SET module = ?, updated_at = datetime('now') WHERE module IS NULL OR module = ''",
      )
      .run(target).changes;
  }
  if (source === target) return 0;
  return db
    .prepare("UPDATE issue SET module = ?, updated_at = datetime('now') WHERE module = ?")
    .run(target, source).changes;
}

export function projectRecords(filters = {}) {
  const { clause, params } = buildFilters({ ...filters, module: undefined, status: undefined });
  return db
    .prepare(
      `SELECT i.source, i.module, i.issue_type_id, i.classification_status, i.raw_classification
       FROM issue i ${clause}`,
    )
    .all(...params);
}
