import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omission-learn-'));
process.env.DB_DIR = dir;
process.env.DB_PATH = path.join(dir, 'learn.db');

const issueTypeRepo = await import('../src/repositories/issueTypeRepo.js');
const issueRepo = await import('../src/repositories/issueRepo.js');
const { suggestKeywords, learnAndReclassify } = await import('../src/services/learningService.js');

test('suggestKeywords 提取描述片段并排除已有规则与泛化词', () => {
  const type = issueTypeRepo.create('电子与通讯');
  issueTypeRepo.addRule(type.id, '电压');
  const withRules = issueTypeRepo.findById(type.id);

  const candidates = suggestKeywords('主板电压偏低导致无法开机', withRules);
  assert.ok(candidates.includes('主板电压偏低导致无法开机'));
  assert.ok(!candidates.some((keyword) => keyword === '电压'));
  assert.ok(candidates.every((keyword) => keyword !== '问题'));
  assert.deepEqual(suggestKeywords('', withRules), []);
});

test('learnAndReclassify 添加规则并自动归类待分类记录', () => {
  const type = issueTypeRepo.create('温控异常');
  issueRepo.createMany([
    { source: 'test', raw_description: '箱内温度超出上限报警', classification_status: 'pending' },
    { source: 'client', raw_description: '整体外观无异常', classification_status: 'pending' },
  ]);

  const result = learnAndReclassify(type.id, ['温度超出', '问题']);
  assert.deepEqual(result.added, ['温度超出']);
  assert.equal(result.classified, 1);
  assert.ok(issueTypeRepo.findRule(type.id, '温度超出'));

  const rows = issueRepo.list({ status: 'auto' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].issue_type_id, type.id);
  assert.equal(rows[0].raw_description, '箱内温度超出上限报警');

  const again = learnAndReclassify(type.id, ['温度超出']);
  assert.deepEqual(again.added, []);
  assert.equal(again.classified, 0);
});
