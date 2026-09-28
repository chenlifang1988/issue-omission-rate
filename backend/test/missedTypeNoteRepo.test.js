import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omission-note-'));
process.env.DB_DIR = dir;
process.env.DB_PATH = path.join(dir, 'note.db');

const issueTypeRepo = await import('../src/repositories/issueTypeRepo.js');
const missedTypeNoteRepo = await import('../src/repositories/missedTypeNoteRepo.js');

test('未测出类型的原因定位与改进措施可新增、更新并批量读取', () => {
  const t1 = issueTypeRepo.create('备注类型A');
  const t2 = issueTypeRepo.create('备注类型B');

  assert.equal(missedTypeNoteRepo.findByTypeId(t1.id), undefined);
  assert.deepEqual([...missedTypeNoteRepo.findByTypeIds([t1.id, t2.id]).keys()], []);

  missedTypeNoteRepo.upsert(t1.id, { cause: '结构设计未覆盖', action: '增加包装工况验证' });
  let note = missedTypeNoteRepo.findByTypeId(t1.id);
  assert.equal(note.cause, '结构设计未覆盖');
  assert.equal(note.action, '增加包装工况验证');

  missedTypeNoteRepo.upsert(t1.id, { cause: '结构设计未覆盖', action: '增加包装工况与堆码验证' });
  note = missedTypeNoteRepo.findByTypeId(t1.id);
  assert.equal(note.action, '增加包装工况与堆码验证');

  const map = missedTypeNoteRepo.findByTypeIds([t1.id, t2.id]);
  assert.equal(map.get(t1.id).cause, '结构设计未覆盖');
  assert.equal(map.has(t2.id), false);
});

test('未测出类型备注支持清空', () => {
  const t3 = issueTypeRepo.create('备注类型C');
  missedTypeNoteRepo.upsert(t3.id, { cause: '原因', action: '措施' });
  missedTypeNoteRepo.upsert(t3.id, { cause: '', action: '' });
  const note = missedTypeNoteRepo.findByTypeId(t3.id);
  assert.equal(note.cause, '');
  assert.equal(note.action, '');
});
