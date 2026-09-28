import type {
  Issue,
  IssueType,
  IssueSummary,
  OmissionStats,
  MissedType,
  ProjectStat,
  ImportMapping,
  ImportResult,
  ImportRow,
  KeywordRule,
  Source,
} from '../types';

const BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.error || `请求失败 (${response.status})`);
  }
  return payload.data as T;
}

function toQuery(params: object): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export interface IssueFilters {
  source?: string;
  issueTypeId?: number | '';
  status?: string;
  module?: string;
  startDate?: string;
  endDate?: string;
}

export interface StatsFilters {
  module?: string;
  startDate?: string;
  endDate?: string;
}

export const issueTypeApi = {
  list: (enabled?: boolean) =>
    request<IssueType[]>(`/issue-types${enabled === undefined ? '' : `?enabled=${enabled}`}`),
  create: (name: string) =>
    request<IssueType>('/issue-types', { method: 'POST', body: JSON.stringify({ name }) }),
  update: (id: number, patch: { name?: string; enabled?: boolean }) =>
    request<IssueType>(`/issue-types/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id: number) => request<void>(`/issue-types/${id}`, { method: 'DELETE' }),
  addRule: (id: number, keyword: string) =>
    request<KeywordRule>(`/issue-types/${id}/rules`, {
      method: 'POST',
      body: JSON.stringify({ keyword }),
    }),
  removeRule: (ruleId: number) => request<void>(`/issue-types/rules/${ruleId}`, { method: 'DELETE' }),
  updateNote: (id: number, note: { cause: string; action: string }) =>
    request<{ issue_type_id: number; cause: string; action: string; updated_at: string }>(
      `/issue-types/${id}/note`,
      { method: 'PUT', body: JSON.stringify(note) },
    ),
  learn: (id: number, keywords: string[]) =>
    request<{ added: string[]; classified: number }>(`/issue-types/${id}/learn`, {
      method: 'POST',
      body: JSON.stringify({ keywords }),
    }),
};

export const issueApi = {
  list: (filters: IssueFilters = {}) => request<Issue[]>(`/issues${toQuery(filters)}`),
  summary: () => request<IssueSummary>('/issues/summary'),
  modules: () => request<string[]>('/issues/modules'),
  learnCandidates: (id: number) => request<string[]>(`/issues/${id}/learn-candidates`),
  renameModule: (payload: { from: string | null; to: string }) =>
    request<{ changed: number; merged: boolean; from: string | null; to: string }>('/issues/modules', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  classify: (id: number, issueTypeId: number | null) =>
    request<Issue>(`/issues/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ issue_type_id: issueTypeId }),
    }),
  remove: (id: number) => request<void>(`/issues/${id}`, { method: 'DELETE' }),
  clearSource: (source: Source) =>
    request<{ removed: number }>(`/issues${toQuery({ source })}`, { method: 'DELETE' }),
};

export const importApi = {
  preview: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ headers: string[]; rows: ImportRow[]; total: number }>('/imports/preview', {
      method: 'POST',
      body: form,
    });
  },
  commit: (payload: {
    source: Source;
    mapping: ImportMapping;
    rows: ImportRow[];
    mode: 'replace' | 'append';
  }) =>
    request<ImportResult>('/imports/commit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const statsApi = {
  omission: (filters: StatsFilters = {}) =>
    request<OmissionStats>(`/stats/omission${toQuery(filters)}`),
  missedTypes: (filters: StatsFilters = {}) =>
    request<MissedType[]>(`/stats/missed-types${toQuery(filters)}`),
  byProject: (filters: StatsFilters = {}) =>
    request<ProjectStat[]>(`/stats/by-project${toQuery(filters)}`),
};
