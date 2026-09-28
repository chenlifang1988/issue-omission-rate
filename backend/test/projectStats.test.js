import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateProjectStats,
  projectKey,
  UNSPECIFIED_PROJECT,
} from '../src/services/projectStats.js';

test('按项目分别计算 A、B、重叠、遗漏率、待分类与客户端类型数', () => {
  const stats = calculateProjectStats([
    { source: 'test', module: 'P1', issue_type_id: 1, classification_status: 'auto', raw_classification: null },
    { source: 'test', module: 'P1', issue_type_id: 2, classification_status: 'auto', raw_classification: null },
    { source: 'client', module: 'P1', issue_type_id: 2, classification_status: 'auto', raw_classification: 'x' },
    { source: 'client', module: 'P1', issue_type_id: 3, classification_status: 'manual', raw_classification: null },
    { source: 'client', module: 'P1', issue_type_id: null, classification_status: 'pending', raw_classification: 'y' },
    { source: 'test', module: 'P2', issue_type_id: 1, classification_status: 'auto', raw_classification: null },
    { source: 'client', module: 'P2', issue_type_id: 1, classification_status: 'auto', raw_classification: 'z' },
  ]);

  const p1 = stats.find((item) => item.project === 'P1');
  assert.equal(p1.a, 2);
  assert.equal(p1.b, 1);
  assert.equal(p1.overlap, 1);
  assert.equal(p1.pending, 1);
  assert.equal(p1.clientTotal, 2);
  assert.equal(Number(p1.rate.toFixed(4)), Number((1 / 3).toFixed(4)));

  const p2 = stats.find((item) => item.project === 'P2');
  assert.equal(p2.a, 1);
  assert.equal(p2.b, 0);
  assert.equal(p2.overlap, 1);
  assert.equal(p2.rate, 0);
  assert.equal(p2.clientTotal, 1);
});

test('空项目名归入未标注项目', () => {
  const stats = calculateProjectStats([
    { source: 'client', module: null, issue_type_id: 1, classification_status: 'auto', raw_classification: 'a' },
    { source: 'client', module: '  ', issue_type_id: 1, classification_status: 'auto', raw_classification: 'a' },
  ]);

  assert.equal(stats.length, 1);
  assert.equal(stats[0].project, UNSPECIFIED_PROJECT);
  assert.equal(projectKey(undefined), UNSPECIFIED_PROJECT);
  assert.equal(projectKey(' 项目甲 '), '项目甲');
});
