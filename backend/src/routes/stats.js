import { Router } from 'express';
import * as issueRepo from '../repositories/issueRepo.js';
import * as issueTypeRepo from '../repositories/issueTypeRepo.js';
import * as missedTypeNoteRepo from '../repositories/missedTypeNoteRepo.js';
import { calculateOmission } from '../services/omissionCalculator.js';
import { calculateProjectStats } from '../services/projectStats.js';

const router = Router();

function parseFilters(query) {
  const { startDate, endDate, module } = query;
  return { filters: { startDate, endDate, module }, startDate, endDate, module };
}

router.get('/omission', (req, res) => {
  const { filters, startDate, endDate, module } = parseFilters(req.query);
  const records = issueRepo.statsRecords(filters);
  const result = calculateOmission(records);
  const pending = issueRepo.pendingCount(filters);
  const clientTotal = issueRepo.countRawClassifications(filters);
  res.json({
    data: {
      a: result.a,
      b: result.b,
      overlap: result.overlap,
      rate: result.rate,
      empty: result.empty,
      pending,
      clientTotal,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        module: module || null,
      },
    },
  });
});

router.get('/by-project', (req, res) => {
  const { startDate, endDate } = req.query;
  const records = issueRepo.projectRecords({ startDate, endDate });
  res.json({ data: calculateProjectStats(records) });
});

router.get('/missed-types', (req, res) => {
  const { filters } = parseFilters(req.query);
  const records = issueRepo.statsRecords(filters);
  const { clientOnlyTypeIds } = calculateOmission(records);
  const notes = missedTypeNoteRepo.findByTypeIds(clientOnlyTypeIds);
  const data = issueRepo
    .typeStats(clientOnlyTypeIds, filters)
    .map((item) => {
      const type = issueTypeRepo.findById(item.issue_type_id);
      const note = notes.get(item.issue_type_id);
      return {
        issue_type_id: item.issue_type_id,
        issue_type_name: type ? type.name : `#${item.issue_type_id}`,
        record_count: item.record_count,
        samples: item.samples,
        cause: note?.cause || '',
        action: note?.action || '',
      };
    })
    .sort((a, b) => b.record_count - a.record_count || a.issue_type_name.localeCompare(b.issue_type_name, 'zh'));
  res.json({ data });
});

export default router;
