export const STATUS_AUTO = 'auto';
export const STATUS_MANUAL = 'manual';
export const STATUS_PENDING = 'pending';

export function normalizeText(text) {
  if (text === undefined || text === null) return '';
  return String(text)
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[!-/:-@[-`{-~\u3001-\u303f\uff01-\uff5e]/g, '');
}

export function buildRuleIndex(types) {
  const rules = [];
  for (const type of types) {
    if (!type.enabled) continue;
    rules.push({ issue_type_id: type.id, keyword: type.name, implicit: true });
    for (const rule of type.rules || []) {
      rules.push({ issue_type_id: type.id, keyword: rule.keyword, implicit: false });
    }
  }
  return rules
    .filter((rule) => normalizeText(rule.keyword).length > 0)
    .map((rule) => ({ ...rule, normalized: normalizeText(rule.keyword) }));
}

export function classify(description, ruleIndex) {
  const normalizedDescription = normalizeText(description);
  if (!normalizedDescription) {
    return { issue_type_id: null, matched_keyword: null, status: STATUS_PENDING };
  }

  let best = null;
  for (const rule of ruleIndex) {
    if (normalizedDescription.includes(rule.normalized)) {
      if (!best || rule.normalized.length > best.normalized.length) {
        best = rule;
      }
    }
  }

  if (!best) {
    return { issue_type_id: null, matched_keyword: null, status: STATUS_PENDING };
  }

  return {
    issue_type_id: best.issue_type_id,
    matched_keyword: best.keyword,
    status: STATUS_AUTO,
  };
}
