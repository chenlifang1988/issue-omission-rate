<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { issueApi, issueTypeApi } from '../api';
import { notify } from '../composables/useMessage';
import { SOURCE_LABEL, STATUS_LABEL } from '../types';
import type { Issue, IssueType, Source } from '../types';

const issues = ref<Issue[]>([]);
const types = ref<IssueType[]>([]);
const modules = ref<string[]>([]);
const loading = ref(false);

const filters = ref({
  source: '',
  issueTypeId: '' as number | '',
  status: '',
  module: '',
  startDate: '',
  endDate: '',
});

const pendingCount = computed(
  () => issues.value.filter((issue) => issue.classification_status === 'pending').length,
);

interface LearnDialogState {
  issueId: number;
  typeId: number;
  typeName: string;
  candidates: { keyword: string; checked: boolean }[];
  custom: string;
}

const learnDialog = ref<LearnDialogState | null>(null);
const learning = ref(false);

const enabledTypes = computed(() => types.value.filter((type) => type.enabled));

async function load() {
  loading.value = true;
  try {
    issues.value = await issueApi.list({
      source: filters.value.source || undefined,
      issueTypeId: filters.value.issueTypeId || undefined,
      status: filters.value.status || undefined,
      module: filters.value.module || undefined,
      startDate: filters.value.startDate || undefined,
      endDate: filters.value.endDate || undefined,
    });
  } catch (error) {
    notify((error as Error).message, 'error');
  } finally {
    loading.value = false;
  }
}

async function loadMeta() {
  try {
    [types.value, modules.value] = await Promise.all([issueTypeApi.list(), issueApi.modules()]);
  } catch (error) {
    notify((error as Error).message, 'error');
  }
}

function typeName(issue: Issue) {
  return issue.issue_type_name || '';
}

async function resolveTypeId(name: string): Promise<number> {
  const lowered = name.toLowerCase();
  const existing = types.value.find((type) => type.name.toLowerCase() === lowered);
  if (existing) return existing.id;
  try {
    const created = await issueTypeApi.create(name);
    types.value = [...types.value, created];
    notify(`已新增分类「${name}」`);
    return created.id;
  } catch (error) {
    const list = await issueTypeApi.list();
    types.value = list;
    const found = list.find((type) => type.name.toLowerCase() === lowered);
    if (found) return found.id;
    throw error;
  }
}

async function changeType(issue: Issue, event: Event) {
  const input = event.target as HTMLInputElement;
  const value = input.value.trim();
  const previous = typeName(issue);
  try {
    if (!value) {
      if (issue.issue_type_id) {
        await issueApi.classify(issue.id, null);
        notify('已设为待分类');
      }
    } else {
      if (value === previous) return;
      const typeId = await resolveTypeId(value);
      await issueApi.classify(issue.id, typeId);
      notify('已更新分类');
      await openLearnDialog(issue.id, typeId, value);
    }
    await load();
  } catch (error) {
    notify((error as Error).message, 'error');
    input.value = previous;
  }
}

async function openLearnDialog(issueId: number, typeId: number, typeLabel: string) {
  let candidates: string[] = [];
  try {
    candidates = await issueApi.learnCandidates(issueId);
  } catch {
    candidates = [];
  }
  if (!candidates.length) return;
  learnDialog.value = {
    issueId,
    typeId,
    typeName: typeLabel,
    candidates: candidates.map((keyword) => ({ keyword, checked: true })),
    custom: '',
  };
}

async function confirmLearn() {
  if (!learnDialog.value) return;
  const dialog = learnDialog.value;
  const keywords = dialog.candidates.filter((item) => item.checked).map((item) => item.keyword);
  const custom = dialog.custom.trim();
  if (custom) keywords.push(custom);
  if (!keywords.length) {
    notify('请至少选择一个关键词或填写补充关键词', 'error');
    return;
  }
  learning.value = true;
  try {
    const result = await issueTypeApi.learn(dialog.typeId, keywords);
    notify(`已记住 ${result.added.length} 条规则，自动归类 ${result.classified} 条待分类问题`);
    learnDialog.value = null;
    await loadMeta();
    await load();
  } catch (error) {
    notify((error as Error).message, 'error');
  } finally {
    learning.value = false;
  }
}

async function remove(issue: Issue) {
  if (!window.confirm('确定删除这条问题记录吗？')) return;
  try {
    await issueApi.remove(issue.id);
    notify('已删除');
    await load();
  } catch (error) {
    notify((error as Error).message, 'error');
  }
}

function resetFilters() {
  filters.value = { source: '', issueTypeId: '', status: '', module: '', startDate: '', endDate: '' };
  load();
}

function showPending() {
  filters.value = { source: '', issueTypeId: '', status: 'pending', module: '', startDate: '', endDate: '' };
  load();
}

onMounted(async () => {
  await loadMeta();
  await load();
});
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <h2 style="margin: 0">分类校对</h2>
      <span v-if="pendingCount" class="warn-badge">当前列表有待分类 {{ pendingCount }} 条</span>
    </div>
    <div class="row">
      <div class="field">
        <label>来源</label>
        <select v-model="filters.source">
          <option value="">全部</option>
          <option value="test">测试验证</option>
          <option value="client">客户端</option>
        </select>
      </div>
      <div class="field">
        <label>问题类型</label>
        <select v-model="filters.issueTypeId">
          <option value="">全部</option>
          <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
        </select>
      </div>
      <div class="field">
        <label>分类状态</label>
        <select v-model="filters.status">
          <option value="">全部</option>
          <option value="pending">待分类</option>
          <option value="auto">自动</option>
          <option value="manual">人工</option>
        </select>
      </div>
      <div class="field">
        <label>项目</label>
        <select v-model="filters.module">
          <option value="">全部</option>
          <option value="__none__">未标注项目</option>
          <option v-for="item in modules" :key="item" :value="item">{{ item }}</option>
        </select>
      </div>
      <div class="field">
        <label>开始日期</label>
        <input v-model="filters.startDate" type="date" />
      </div>
      <div class="field">
        <label>结束日期</label>
        <input v-model="filters.endDate" type="date" />
      </div>
      <button class="primary" :disabled="loading" @click="load">查询</button>
      <button :disabled="loading" @click="resetFilters">重置</button>
      <button class="warn" @click="showPending">只看待分类</button>
    </div>
  </div>

  <div class="panel">
    <div class="toolbar">
      <h2 style="margin: 0">问题明细（{{ issues.length }} 条）</h2>
      <button :disabled="loading" @click="load">刷新</button>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 88px">来源</th>
          <th>问题描述</th>
          <th style="width: 180px">问题类型</th>
          <th style="width: 90px">分类状态</th>
          <th style="width: 110px">命中关键词</th>
          <th style="width: 100px">项目</th>
          <th style="width: 110px">发生日期</th>
          <th style="width: 70px">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="issue in issues"
          :key="issue.id"
          :class="{ pending: issue.classification_status === 'pending' }"
        >
          <td>
            <span class="tag" :class="{ client: issue.source === 'client' }">
              {{ SOURCE_LABEL[issue.source as Source] }}
            </span>
          </td>
          <td class="desc">{{ issue.raw_description }}</td>
          <td>
            <input
              :value="typeName(issue)"
              list="issue-type-options"
              class="type-input"
              placeholder="选择或输入新分类"
              title="下拉选择已有分类；输入不存在的名称将自动新增"
              @change="changeType(issue, $event)"
            />
          </td>
          <td>
            <span class="status" :class="issue.classification_status">
              {{ STATUS_LABEL[issue.classification_status] }}
            </span>
          </td>
          <td>{{ issue.matched_keyword || '-' }}</td>
          <td>{{ issue.module || '-' }}</td>
          <td>{{ issue.occurred_date || '-' }}</td>
          <td>
            <button class="small danger" @click="remove(issue)">删除</button>
          </td>
        </tr>
        <tr v-if="!issues.length">
          <td colspan="8" class="empty">暂无问题记录，请先在「批量导入」页导入数据</td>
        </tr>
      </tbody>
    </table>
    <datalist id="issue-type-options">
      <option v-for="type in enabledTypes" :key="type.id" :value="type.name"></option>
    </datalist>
  </div>

  <div v-if="learnDialog" class="overlay" @click.self="learnDialog = null">
    <div class="dialog">
      <h3>学习分类规则</h3>
      <p class="dialog-hint">
        已将该问题归为「{{ learnDialog.typeName }}」。勾选要记住的关键词，之后包含这些关键词的问题会自动归入该分类。
      </p>
      <div class="candidate-list">
        <label v-for="(item, index) in learnDialog.candidates" :key="index" class="candidate">
          <input v-model="item.checked" type="checkbox" />
          <span>{{ item.keyword }}</span>
        </label>
      </div>
      <div class="field">
        <label>补充关键词（可选）</label>
        <input
          v-model="learnDialog.custom"
          placeholder="例如：浓度偏低"
          @keydown.enter.prevent="confirmLearn"
        />
      </div>
      <div class="dialog-actions">
        <button class="primary" :disabled="learning" @click="confirmLearn">记住规则</button>
        <button :disabled="learning" @click="learnDialog = null">忽略</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.warn-badge {
  background: #fef3c7;
  color: #b45309;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
}

button.warn {
  border-color: #fde68a;
  color: #b45309;
}

button.warn:hover {
  background: #fffbeb;
  border-color: #f59e0b;
  color: #b45309;
}

tr.pending {
  background: #fffbeb;
}

.desc {
  white-space: normal;
  min-width: 220px;
}

.type-input {
  width: 100%;
}

.status {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: #eff6ff;
  color: var(--primary);
}

.status.pending {
  background: #fef3c7;
  color: #b45309;
}

.status.manual {
  background: #dcfce7;
  color: #15803d;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.dialog {
  width: min(520px, 92vw);
  background: #fff;
  border-radius: 12px;
  padding: 20px 22px;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.25);
}

.dialog h3 {
  margin: 0 0 10px;
}

.dialog-hint {
  margin: 0 0 14px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.candidate-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.candidate {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  font-size: 13px;
  cursor: pointer;
}

.candidate input {
  margin: 0;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
</style>
