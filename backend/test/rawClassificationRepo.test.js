import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omission-repo-'));
process.env.DB_DIR = dir;
process.env.DB_PATH = path.join(dir, 'repo.db');

const issueRepo = await import('../src/repositories/issueRepo.js');
const issueTypeRepo = await import('../src/repositories/issueTypeRepo.js');

test('看板客户端问题类型数按原始分类去重统计', () => {
  const t1 = issueTypeRepo.create('测试类型A');
  const t2 = issueTypeRepo.create('测试类型B');
  issueRepo.createMany([
    { source: 'client', raw_description: 'a1', raw_classification: '拍照异常', issue_type_id: t1.id, classification_status: 'auto' },
    { source: 'client', raw_description: 'a2', raw_classification: '拍照异常', issue_type_id: t1.id, classification_status: 'auto' },
    { source: 'client', raw_description: 'a3', raw_classification: '流体异常', issue_type_id: t2.id, classification_status: 'auto' },
    { source: 'client', raw_description: 'a4', raw_classification: null, issue_type_id: t2.id, classification_status: 'manual' },
    { source: 'test', raw_description: 'b1', raw_classification: '黑影', issue_type_id: t1.id, classification_status: 'auto' },
  ]);

  assert.equal(issueRepo.countRawClassifications(), 2);
  assert.equal(issueRepo.countRawClassifications({ module: '不存在的模块' }), 0);
});

test('原始分类去重包含待分类记录的原始值', () => {
  const before = issueRepo.countRawClassifications();
  const t3 = issueTypeRepo.create('测试类型C');
  issueRepo.createMany([
    { source: 'client', raw_description: 'c1', raw_classification: '电源异常', issue_type_id: t3.id, classification_status: 'auto' },
    { source: 'client', raw_description: 'c2', raw_classification: '未知的新分类', issue_type_id: null, classification_status: 'pending' },
  ]);

  assert.equal(issueRepo.countRawClassifications(), before + 2);
});

test('未测出类型明细汇总客户端记录数与示例描述', () => {
  const target = issueTypeRepo.findByName('测试类型A');
  const before = issueRepo.typeStats([target.id])[0].record_count;
  issueRepo.createMany([
    { source: 'client', raw_description: 'd1', raw_classification: 'x', issue_type_id: target.id, classification_status: 'auto' },
    { source: 'client', raw_description: 'd2', raw_classification: 'y', issue_type_id: target.id, classification_status: 'auto' },
    { source: 'test', raw_description: 'd3', raw_classification: 'z', issue_type_id: target.id, classification_status: 'auto' },
  ]);

  const [detail] = issueRepo.typeStats([target.id]);
  assert.equal(detail.issue_type_id, target.id);
  assert.equal(detail.record_count, before + 2);
  assert.equal(detail.samples.length, 3);
  assert.deepEqual(issueRepo.typeStats([target.id], { module: '不存在的模块' }), [
    { issue_type_id: target.id, record_count: 0, samples: [] },
  ]);
});

test('按项目清空仅移除同项目记录，保留其他项目', () => {
  const target = issueTypeRepo.findByName('测试类型A');
  const before = issueRepo.list({ source: 'client' }).length;
  issueRepo.createMany([
    { source: 'client', raw_description: 'p1', module: '项目甲', issue_type_id: target.id, classification_status: 'auto' },
    { source: 'client', raw_description: 'p2', module: '项目乙', issue_type_id: target.id, classification_status: 'auto' },
    { source: 'client', raw_description: 'p3', module: null, issue_type_id: target.id, classification_status: 'auto' },
  ]);

  assert.equal(issueRepo.removeBySourceAndModules('client', ['项目甲']), 1);
  assert.equal(issueRepo.list({ source: 'client' }).length, before + 2);
  assert.equal(issueRepo.list({ source: 'client' }).filter((row) => row.module === '项目乙').length, 1);

  const nullBefore = issueRepo.list({ source: 'client' }).filter((row) => row.module == null).length;
  assert.equal(issueRepo.removeBySourceAndModules('client', [null]), nullBefore);
  assert.equal(issueRepo.list({ source: 'client' }).filter((row) => row.module == null).length, 0);
});

test('重命名项目更新同名记录并保留其他项目', () => {
  const target = issueTypeRepo.findByName('测试类型A');
  issueRepo.createMany([
    { source: 'client', raw_description: 'r1', module: '待改名项目', issue_type_id: target.id, classification_status: 'auto' },
    { source: 'test', raw_description: 'r2', module: '待改名项目', issue_type_id: target.id, classification_status: 'auto' },
    { source: 'client', raw_description: 'r3', module: '保留项目', issue_type_id: target.id, classification_status: 'auto' },
  ]);

  assert.equal(issueRepo.renameModule('待改名项目', '新项目名'), 2);
  assert.equal(issueRepo.list({ module: '新项目名' }).length, 2);
  assert.equal(issueRepo.list({ module: '待改名项目' }).length, 0);
  assert.equal(issueRepo.list({ module: '保留项目' }).length, 1);
  assert.equal(issueRepo.renameModule('新项目名', '新项目名'), 0);

  issueRepo.createMany([
    { source: 'client', raw_description: 'r4', module: null, issue_type_id: target.id, classification_status: 'auto' },
    { source: 'client', raw_description: 'r5', module: '', issue_type_id: target.id, classification_status: 'auto' },
  ]);
  const nullBefore = issueRepo.list({ module: '__none__' }).length;
  assert.equal(issueRepo.renameModule(null, '补标项目'), nullBefore);
  assert.equal(issueRepo.list({ module: '补标项目' }).length, nullBefore);
  assert.equal(issueRepo.list({ module: '__none__' }).length, 0);
});

