import { Router } from 'express';
import * as issueRepo from '../repositories/issueRepo.js';
import * as issueTypeRepo from '../repositories/issueTypeRepo.js';
import { STATUS_MANUAL, STATUS_PENDING } from '../services/classifier.js';
import { isValidSource } from '../services/omissionCalculator.js';
import { UNSPECIFIED_PROJECT } from '../services/projectStats.js';
import { suggestKeywords } from '../services/learningService.js';

const router = Router();

router.get('/', (req, res) => {
  const { source, issueTypeId, status, module, startDate, endDate, limit } = req.query;
  res.json({
    data: issueRepo.list({
      source,
      issueTypeId: issueTypeId ? Number(issueTypeId) : undefined,
      status,
      module,
      startDate,
      endDate,
      limit,
    }),
  });
});

router.get('/summary', (req, res) => {
  res.json({ data: issueRepo.summary() });
});

router.get('/modules', (req, res) => {
  res.json({ data: issueRepo.listModules() });
});

router.get('/:id/learn-candidates', (req, res) => {
  const id = Number(req.params.id);
  const issue = issueRepo.findById(id);
  if (!issue) {
    return res.status(404).json({ error: '问题记录不存在' });
  }
  if (!issue.issue_type_id) {
    return res.json({ data: [] });
  }
  const type = issueTypeRepo.findById(issue.issue_type_id);
  res.json({ data: suggestKeywords(issue.raw_description, type) });
});

router.patch('/modules', (req, res) => {
  const to = String(req.body?.to ?? '').trim();
  if (!to) {
    return res.status(400).json({ error: '项目名称不能为空' });
  }
  if (to === UNSPECIFIED_PROJECT) {
    return res.status(400).json({ error: `「${UNSPECIFIED_PROJECT}」为系统占位名称，请使用其他名称` });
  }
  const from = req.body?.from === undefined || req.body?.from === null ? '' : String(req.body.from);
  const source = from.trim();
  const merged = source !== '' && issueRepo.listModules().some((item) => item.trim() === to && item.trim() !== source);
  const changed = issueRepo.renameModule(source, to);
  res.json({ data: { changed, merged, from: source || null, to } });
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!issueRepo.findById(id)) {
    return res.status(404).json({ error: '问题记录不存在' });
  }
  const rawTypeId = req.body?.issue_type_id;
  if (rawTypeId === null || rawTypeId === undefined || rawTypeId === '') {
    return res.json({
      data: issueRepo.updateClassification(id, {
        issue_type_id: null,
        matched_keyword: null,
        classification_status: STATUS_PENDING,
      }),
    });
  }
  const typeId = Number(rawTypeId);
  if (!issueTypeRepo.findById(typeId)) {
    return res.status(400).json({ error: '问题类型不存在' });
  }
  res.json({
    data: issueRepo.updateClassification(id, {
      issue_type_id: typeId,
      matched_keyword: null,
      classification_status: STATUS_MANUAL,
    }),
  });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!issueRepo.findById(id)) {
    return res.status(404).json({ error: '问题记录不存在' });
  }
  issueRepo.remove(id);
  res.status(204).end();
});

router.delete('/', (req, res) => {
  const { source } = req.query;
  if (!isValidSource(source)) {
    return res.status(400).json({ error: '请指定要清空的来源' });
  }
  const removed = issueRepo.removeBySource(source);
  res.json({ data: { removed } });
});

export default router;
