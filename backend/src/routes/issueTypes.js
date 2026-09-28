import { Router } from 'express';
import * as issueTypeRepo from '../repositories/issueTypeRepo.js';
import * as missedTypeNoteRepo from '../repositories/missedTypeNoteRepo.js';
import { learnAndReclassify } from '../services/learningService.js';

const router = Router();

router.get('/', (req, res) => {
  const { enabled } = req.query;
  const filter = enabled === undefined ? {} : { enabled: enabled !== 'false' && enabled !== '0' };
  res.json({ data: issueTypeRepo.list(filter) });
});

router.post('/', (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) {
    return res.status(400).json({ error: '问题类型名称不能为空' });
  }
  if (issueTypeRepo.findByName(name)) {
    return res.status(409).json({ error: `问题类型「${name}」已存在` });
  }
  res.status(201).json({ data: issueTypeRepo.create(name) });
});

router.delete('/rules/:ruleId', (req, res) => {
  const ruleId = Number(req.params.ruleId);
  const rule = issueTypeRepo.findRuleById(ruleId);
  if (!rule) {
    return res.status(404).json({ error: '关键词规则不存在' });
  }
  issueTypeRepo.removeRule(ruleId);
  res.status(204).end();
});

router.post('/:id/learn', (req, res) => {
  const id = Number(req.params.id);
  if (!issueTypeRepo.findById(id)) {
    return res.status(404).json({ error: '问题类型不存在' });
  }
  const keywords = Array.isArray(req.body?.keywords) ? req.body.keywords : [];
  res.json({ data: learnAndReclassify(id, keywords) });
});

router.post('/:id/rules', (req, res) => {
  const id = Number(req.params.id);
  if (!issueTypeRepo.findById(id)) {
    return res.status(404).json({ error: '问题类型不存在' });
  }
  const keyword = String(req.body?.keyword ?? '').trim();
  if (!keyword) {
    return res.status(400).json({ error: '关键词不能为空' });
  }
  if (issueTypeRepo.findRule(id, keyword)) {
    return res.status(409).json({ error: `关键词「${keyword}」已存在` });
  }
  res.status(201).json({ data: issueTypeRepo.addRule(id, keyword) });
});

router.put('/:id/note', (req, res) => {
  const id = Number(req.params.id);
  if (!issueTypeRepo.findById(id)) {
    return res.status(404).json({ error: '问题类型不存在' });
  }
  const cause = req.body?.cause === undefined ? '' : String(req.body.cause).trim();
  const action = req.body?.action === undefined ? '' : String(req.body.action).trim();
  res.json({ data: missedTypeNoteRepo.upsert(id, { cause, action }) });
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const current = issueTypeRepo.findById(id);
  if (!current) {
    return res.status(404).json({ error: '问题类型不存在' });
  }
  let name;
  if (req.body?.name !== undefined) {
    name = String(req.body.name).trim();
    if (!name) {
      return res.status(400).json({ error: '问题类型名称不能为空' });
    }
    const duplicate = issueTypeRepo.findByName(name);
    if (duplicate && duplicate.id !== id) {
      return res.status(409).json({ error: `问题类型「${name}」已存在` });
    }
  }
  const enabled = req.body?.enabled === undefined ? undefined : Boolean(req.body.enabled);
  res.json({ data: issueTypeRepo.update(id, { name, enabled }) });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const current = issueTypeRepo.findById(id);
  if (!current) {
    return res.status(404).json({ error: '问题类型不存在' });
  }
  const referenced = issueTypeRepo.countIssues(id);
  if (referenced > 0) {
    return res.status(409).json({ error: `该类型已被 ${referenced} 条问题记录引用，无法删除` });
  }
  issueTypeRepo.remove(id);
  res.status(204).end();
});

export default router;
