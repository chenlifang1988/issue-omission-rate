export type Source = 'test' | 'client';
export type ClassificationStatus = 'auto' | 'manual' | 'pending';

export interface KeywordRule {
  id: number;
  keyword: string;
}

export interface IssueType {
  id: number;
  name: string;
  enabled: number;
  rules: KeywordRule[];
}

export interface Issue {
  id: number;
  source: Source;
  raw_description: string;
  issue_type_id: number | null;
  issue_type_name: string | null;
  matched_keyword: string | null;
  classification_status: ClassificationStatus;
  module: string | null;
  occurred_date: string | null;
  import_batch: string | null;
  created_at: string;
  updated_at: string;
}

export interface OmissionStats {
  a: number;
  b: number;
  overlap: number;
  rate: number;
  empty: boolean;
  pending: number;
  clientTotal: number;
}

export interface MissedType {
  issue_type_id: number;
  issue_type_name: string;
  record_count: number;
  samples: string[];
  cause: string;
  action: string;
}

export interface ProjectStat {
  project: string;
  a: number;
  b: number;
  overlap: number;
  rate: number;
  pending: number;
  clientTotal: number;
}

export interface ImportRow {
  [header: string]: string | number | Date | undefined;
  __rowNumber?: number;
}

export interface ImportMapping {
  description: string;
  classification?: string;
  module?: string;
  occurredDate?: string;
}

export interface ImportResult {
  source: Source;
  success: number;
  failed: number;
  auto: number;
  pending: number;
  replaced: number;
  errors: { rowNumber: number; reason: string }[];
  ids: number[];
}

export interface IssueSummary {
  client: { total: number; pending: number };
  test: { total: number; pending: number };
}

export const SOURCE_LABEL: Record<Source, string> = {
  test: '测试验证',
  client: '客户端',
};

export const STATUS_LABEL: Record<ClassificationStatus, string> = {
  auto: '自动',
  manual: '人工',
  pending: '待分类',
};
