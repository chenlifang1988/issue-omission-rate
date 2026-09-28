import { db } from '../src/db.js';
import { ensureDictionarySeeded } from '../src/services/dictionarySeed.js';
import { CATEGORIES } from '../src/services/dictionary.js';

const reset = process.argv.includes('--reset');

if (reset) {
  db.exec('DELETE FROM issue; DELETE FROM keyword_rule; DELETE FROM issue_type;');
  console.log('已清空原有字典与问题数据');
}

const seeded = ensureDictionarySeeded();
console.log(seeded ? `已写入默认分类字典（${CATEGORIES.length} 类）` : '字典已存在，跳过写入');
