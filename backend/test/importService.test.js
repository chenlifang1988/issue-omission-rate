import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRows, parseWorkbook } from '../src/services/importService.js';

test('UTF-8 CSV 中文表头正确解码', () => {
  const csv = '\uFEFF问题描述,问题分类,模块\nSBC掉线,电子与通讯,主板\n';
  const { headers, rows } = parseWorkbook(Buffer.from(csv, 'utf8'));
  assert.deepEqual(headers, ['问题描述', '问题分类', '模块']);
  assert.equal(rows[0].问题描述, 'SBC掉线');
  assert.equal(rows[0].问题分类, '电子与通讯');
});

test('映射分类列时保留原始分类值', () => {
  const rows = [
    { __rowNumber: 2, 问题描述: 'SBC掉线', 问题分类: '电子与通讯', 模块: '主板' },
    { __rowNumber: 3, 问题描述: '气泡异常', 问题分类: '', 模块: '液路' },
  ];
  const { valid, errors } = validateRows(rows, {
    description: '问题描述',
    classification: '问题分类',
    module: '模块',
  });
  assert.equal(errors.length, 0);
  assert.equal(valid[0].raw_classification, '电子与通讯');
  assert.equal(valid[0].module, '主板');
  assert.equal(valid[1].raw_classification, null);
});

test('未映射分类列时分类值为空', () => {
  const { valid } = validateRows([{ __rowNumber: 2, 问题描述: '结构干涉' }], {
    description: '问题描述',
  });
  assert.equal(valid[0].raw_classification, null);
});

test('缺少问题描述列时抛出 400', () => {
  assert.throws(
    () => validateRows([{ __rowNumber: 2, 问题描述: 'x' }], {}),
    (error) => error.status === 400,
  );
});
