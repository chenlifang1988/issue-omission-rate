import { SOURCE_TEST, SOURCE_CLIENT } from './omissionCalculator.js';

export const UNSPECIFIED_PROJECT = '未标注项目';

export function projectKey(module) {
  const text = typeof module === 'string' ? module.trim() : '';
  return text || UNSPECIFIED_PROJECT;
}

export function calculateProjectStats(records) {
  const groups = new Map();

  for (const record of records) {
    const key = projectKey(record.module);
    if (!groups.has(key)) {
      groups.set(key, {
        project: key,
        testTypes: new Set(),
        clientTypes: new Set(),
        rawClassifications: new Set(),
        pending: 0,
      });
    }
    const group = groups.get(key);

    const raw = typeof record.raw_classification === 'string' ? record.raw_classification.trim() : '';
    if (record.source === SOURCE_CLIENT && raw) {
      group.rawClassifications.add(raw);
    }

    if (record.classification_status === 'pending') {
      group.pending += 1;
      continue;
    }

    if (record.source === SOURCE_TEST) {
      group.testTypes.add(record.issue_type_id);
    } else if (record.source === SOURCE_CLIENT) {
      group.clientTypes.add(record.issue_type_id);
    }
  }

  return [...groups.values()]
    .map((group) => {
      let overlap = 0;
      for (const typeId of group.clientTypes) {
        if (group.testTypes.has(typeId)) overlap += 1;
      }
      const a = group.testTypes.size;
      const b = group.clientTypes.size - overlap;
      const total = a + b;
      return {
        project: group.project,
        a,
        b,
        overlap,
        rate: total === 0 ? 0 : b / total,
        pending: group.pending,
        clientTotal: group.rawClassifications.size,
      };
    })
    .sort((left, right) => left.project.localeCompare(right.project, 'zh'));
}
