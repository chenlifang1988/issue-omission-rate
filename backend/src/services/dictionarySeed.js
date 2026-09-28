import { db } from '../db.js';
import { CATEGORIES, categoryKeywords } from './dictionary.js';

export function ensureDictionarySeeded() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM issue_type').get();
  if (n > 0) return false;

  const insertType = db.prepare('INSERT INTO issue_type (name) VALUES (?)');
  const insertRule = db.prepare(
    'INSERT OR IGNORE INTO keyword_rule (issue_type_id, keyword) VALUES (?, ?)',
  );

  const seed = db.transaction(() => {
    for (const category of CATEGORIES) {
      const info = insertType.run(category.name);
      for (const keyword of categoryKeywords(category)) {
        insertRule.run(info.lastInsertRowid, keyword);
      }
    }
  });
  seed();
  return true;
}
