import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateOmission, isValidSource } from '../src/services/omissionCalculator.js';

test('空数据集返回全零且 empty 为 true', () => {
  const result = calculateOmission([]);
  assert.equal(result.a, 0);
  assert.equal(result.b, 0);
  assert.equal(result.overlap, 0);
  assert.equal(result.rate, 0);
  assert.equal(result.empty, true);
});

test('仅有测试验证类型时遗漏率为 0', () => {
  const result = calculateOmission([
    { source: 'test', issue_type_id: 1 },
    { source: 'test', issue_type_id: 2 },
    { source: 'test', issue_type_id: 3 },
  ]);
  assert.equal(result.a, 3);
  assert.equal(result.b, 0);
  assert.equal(result.overlap, 0);
  assert.equal(result.rate, 0);
  assert.equal(result.empty, false);
});

test('仅有客户端类型时遗漏率为 100%', () => {
  const result = calculateOmission([
    { source: 'client', issue_type_id: 1 },
    { source: 'client', issue_type_id: 2 },
  ]);
  assert.equal(result.a, 0);
  assert.equal(result.b, 2);
  assert.equal(result.rate, 1);
});

test('重叠类型只计入 A 不计入 B', () => {
  const result = calculateOmission([
    { source: 'test', issue_type_id: 1 },
    { source: 'test', issue_type_id: 2 },
    { source: 'test', issue_type_id: 3 },
    { source: 'client', issue_type_id: 2 },
    { source: 'client', issue_type_id: 4 },
  ]);
  assert.equal(result.a, 3);
  assert.equal(result.b, 1);
  assert.equal(result.overlap, 1);
  assert.equal(result.rate, 0.25);
  assert.deepEqual(result.overlapTypeIds, [2]);
  assert.deepEqual(result.clientOnlyTypeIds, [4]);
});

test('重复记录按问题类型去重', () => {
  const result = calculateOmission([
    { source: 'test', issue_type_id: 1 },
    { source: 'test', issue_type_id: 1 },
    { source: 'client', issue_type_id: 2 },
    { source: 'client', issue_type_id: 2 },
  ]);
  assert.equal(result.a, 1);
  assert.equal(result.b, 1);
  assert.equal(result.rate, 0.5);
});

test('恒等式 |T| + |C\\T| = |T∪C|', () => {
  const records = [
    { source: 'test', issue_type_id: 1 },
    { source: 'test', issue_type_id: 2 },
    { source: 'client', issue_type_id: 2 },
    { source: 'client', issue_type_id: 3 },
    { source: 'client', issue_type_id: 4 },
  ];
  const result = calculateOmission(records);
  const union = new Set(records.map((r) => r.issue_type_id)).size;
  assert.equal(result.a + result.b, union);
});

test('来源合法性校验', () => {
  assert.equal(isValidSource('test'), true);
  assert.equal(isValidSource('client'), true);
  assert.equal(isValidSource('other'), false);
});
