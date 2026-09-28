import { Router } from 'express';
import multer from 'multer';
import * as issueRepo from '../repositories/issueRepo.js';
import * as issueTypeRepo from '../repositories/issueTypeRepo.js';
import { parseWorkbook, validateRows } from '../services/importService.js';
import { buildRuleIndex, classify, STATUS_AUTO, STATUS_PENDING } from '../services/classifier.js';
import { isValidSource } from '../services/omissionCalculator.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/preview', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传文件' });
  }
  try {
    const { headers, rows } = parseWorkbook(req.file.buffer);
    res.json({ data: { headers, rows, total: rows.length } });
  } catch (error) {
    res.status(400).json({ error: `文件解析失败：${error.message}` });
  }
});

router.post('/commit', (req, res) => {
  const { source, mapping, rows, mode } = req.body ?? {};
  if (!isValidSource(source)) {
    return res.status(400).json({ error: '来源必须为「测试验证」或「客户端」' });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: '没有可导入的数据行' });
  }

  let validation;
  try {
    validation = validateRows(rows, mapping);
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message });
  }

  const ruleIndex = buildRuleIndex(issueTypeRepo.list({}));
  const importBatch = new Date().toISOString();

  const prepared = validation.valid.map((row) => {
    let result = classify(row.raw_description, ruleIndex);
    if (row.raw_classification) {
      const byClass = classify(row.raw_classification, ruleIndex);
      if (byClass.issue_type_id) {
        result = {
          issue_type_id: byClass.issue_type_id,
          matched_keyword: row.raw_classification,
          status: STATUS_AUTO,
        };
      }
    }
    return {
      source,
      raw_description: row.raw_description,
      raw_classification: row.raw_classification,
      issue_type_id: result.issue_type_id,
      matched_keyword: result.matched_keyword,
      classification_status: result.status,
      module: row.module,
      occurred_date: row.occurred_date,
      import_batch: importBatch,
    };
  });

  const modules = prepared.map((row) => row.module);
  const replaced = mode === 'replace' ? issueRepo.removeBySourceAndModules(source, modules) : 0;
  const ids = prepared.length ? issueRepo.createMany(prepared) : [];
  const auto = prepared.filter((row) => row.classification_status === STATUS_AUTO).length;
  const pending = prepared.filter((row) => row.classification_status === STATUS_PENDING).length;

  res.json({
    data: {
      source,
      success: prepared.length,
      failed: validation.errors.length,
      auto,
      pending,
      replaced,
      errors: validation.errors,
      ids,
    },
  });
});

export default router;
