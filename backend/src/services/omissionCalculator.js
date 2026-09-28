export const SOURCE_TEST = 'test';
export const SOURCE_CLIENT = 'client';

export function calculateOmission(records) {
  const testTypes = new Set();
  const clientTypes = new Set();

  for (const record of records) {
    if (record.source === SOURCE_TEST) {
      testTypes.add(record.issue_type_id);
    } else if (record.source === SOURCE_CLIENT) {
      clientTypes.add(record.issue_type_id);
    }
  }

  let overlap = 0;
  for (const typeId of clientTypes) {
    if (testTypes.has(typeId)) {
      overlap += 1;
    }
  }

  const a = testTypes.size;
  const b = clientTypes.size - overlap;
  const total = a + b;
  const rate = total === 0 ? 0 : b / total;

  return {
    a,
    b,
    overlap,
    rate,
    empty: total === 0,
    testTypeIds: [...testTypes],
    clientOnlyTypeIds: [...clientTypes].filter((id) => !testTypes.has(id)),
    overlapTypeIds: [...clientTypes].filter((id) => testTypes.has(id)),
  };
}

export function isValidSource(source) {
  return source === SOURCE_TEST || source === SOURCE_CLIENT;
}
