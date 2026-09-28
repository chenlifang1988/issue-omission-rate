import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRuleIndex,
  classify,
  normalizeText,
  STATUS_AUTO,
  STATUS_PENDING,
} from '../src/services/classifier.js';

const types = [
  { id: 1, name: '登录异常', enabled: 1, rules: [{ keyword: '验证码' }, { keyword: '无法登录' }] },
  { id: 2, name: '支付失败', enabled: 1, rules: [{ keyword: '重复扣款' }] },
  { id: 3, name: '支付', enabled: 1, rules: [] },
  { id: 4, name: '崩溃白屏', enabled: 0, rules: [{ keyword: '白屏' }] },
];

test('文本规范化移除空白与标点并转小写', () => {
  assert.equal(normalizeText(' 支付 失败，重复扣款！ '), '支付失败重复扣款');
  assert.equal(normalizeText(null), '');
});

test('没有命中任何规则时进入待分类', () => {
  const index = buildRuleIndex(types);
  const result = classify('页面加载很慢', index);
  assert.equal(result.issue_type_id, null);
  assert.equal(result.matched_keyword, null);
  assert.equal(result.status, STATUS_PENDING);
});

test('类型名称作为隐式关键词参与匹配', () => {
  const index = buildRuleIndex(types);
  const result = classify('用户反馈支付无法完成', index);
  assert.equal(result.issue_type_id, 3);
  assert.equal(result.status, STATUS_AUTO);
});

test('显式关键词命中', () => {
  const index = buildRuleIndex(types);
  const result = classify('收到验证码后无法完成登录', index);
  assert.equal(result.issue_type_id, 1);
  assert.equal(result.matched_keyword, '验证码');
  assert.equal(result.status, STATUS_AUTO);
});

test('多规则命中时选择关键词最长的类型', () => {
  const index = buildRuleIndex(types);
  const result = classify('支付失败导致重复扣款', index);
  assert.equal(result.issue_type_id, 2);
  assert.equal(result.matched_keyword, '支付失败');
});

test('归一化后仍能命中，忽略大小写与标点', () => {
  const index = buildRuleIndex([
    { id: 9, name: 'LoginError', enabled: 1, rules: [{ keyword: 'verify code' }] },
  ]);
  const result = classify('VERIFY-CODE 失败', index);
  assert.equal(result.issue_type_id, 9);
  assert.equal(result.status, STATUS_AUTO);
});

test('停用类型不参与匹配', () => {
  const index = buildRuleIndex(types);
  const result = classify('进入首页白屏', index);
  assert.equal(result.status, STATUS_PENDING);
});

test('空描述进入待分类', () => {
  const index = buildRuleIndex(types);
  const result = classify('', index);
  assert.equal(result.status, STATUS_PENDING);
});
