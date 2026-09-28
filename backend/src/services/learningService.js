import { buildRuleIndex, classify, normalizeText } from './classifier.js';
import * as issueRepo from '../repositories/issueRepo.js';
import * as issueTypeRepo from '../repositories/issueTypeRepo.js';

const GENERIC_WORDS = [
  '问题',
  '异常',
  '故障',
  '不良',
  '其他',
  '情况',
  '现象',
  '存在',
  '出现',
  '导致',
  '测试',
  '客户',
  '功能',
  '性能',
  '外观',
  '尺寸',
];

function splitSegments(description) {
  return String(description ?? '')
    .split(/[\s\u3000，,、;；。.．!！?？:：/|\\()（）\[\]【】{}<>《》"“”'‘’]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function isGeneric(keyword) {
  const normalized = normalizeText(keyword);
  if (!normalized) return true;
  if (/^\d+$/.test(normalized)) return true;
  return GENERIC_WORDS.some((word) => normalizeText(word) === normalized);
}

export function suggestKeywords(description, type) {
  const normalized = normalizeText(description);
  if (!normalized) return [];

  const existing = new Set();
  if (type) {
    existing.add(normalizeText(type.name));
    for (const rule of type.rules || []) existing.add(normalizeText(rule.keyword));
  }

  const candidates = [];
  const push = (value) => {
    const keyword = String(value ?? '').trim();
    const key = normalizeText(keyword);
    if (key.length < 2 || isGeneric(keyword) || existing.has(key)) return;
    if (candidates.some((item) => normalizeText(item) === key)) return;
    candidates.push(keyword);
  };

  for (const segment of splitSegments(description)) {
    const segmentNorm = normalizeText(segment);
    if (segmentNorm.length >= 2) push(segment);
    if (segmentNorm.length > 5) {
      push(segmentNorm.slice(segmentNorm.length - 4));
      push(segmentNorm.slice(segmentNorm.length - 3));
    }
  }

  if (!candidates.length) {
    for (let size = 4; size >= 3; size -= 1) {
      for (let i = 0; i + size <= normalized.length; i += 1) {
        push(normalized.slice(i, i + size));
      }
    }
  }

  return candidates.slice(0, 6);
}

export function learnAndReclassify(typeId, keywords = []) {
  const type = issueTypeRepo.findById(typeId);
  if (!type) return undefined;

  const normalizedTypeName = normalizeText(type.name);
  const added = [];
  for (const raw of keywords) {
    const keyword = String(raw ?? '').trim();
    const key = normalizeText(keyword);
    if (key.length < 2 || key === normalizedTypeName || isGeneric(keyword)) continue;
    if (issueTypeRepo.findRule(typeId, keyword)) continue;
    issueTypeRepo.addRule(typeId, keyword);
    added.push(keyword);
  }

  const ruleIndex = buildRuleIndex(issueTypeRepo.list({ enabled: true }));
  let classified = 0;
  for (const record of issueRepo.pendingRecords()) {
    const result = classify(record.raw_description, ruleIndex);
    if (result.issue_type_id !== null) {
      issueRepo.updateClassification(record.id, {
        issue_type_id: result.issue_type_id,
        matched_keyword: result.matched_keyword,
        classification_status: result.status,
      });
      classified += 1;
    }
  }

  return { added, classified };
}
