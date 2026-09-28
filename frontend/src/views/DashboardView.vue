<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import * as echarts from 'echarts';
import { issueApi, issueTypeApi, statsApi } from '../api';
import { notify } from '../composables/useMessage';
import type { MissedType, OmissionStats, ProjectStat } from '../types';

const NONE_PROJECT = '__none__';
const UNSPECIFIED_PROJECT = '未标注项目';

const stats = ref<OmissionStats>({
  a: 0,
  b: 0,
  overlap: 0,
  rate: 0,
  empty: true,
  pending: 0,
  clientTotal: 0,
});
const filters = ref({ startDate: '', endDate: '', module: '' });
const modules = ref<string[]>([]);
const loading = ref(false);
const missedTypes = ref<MissedType[]>([]);
const showMissed = ref(false);
const loadingMissed = ref(false);
const projectStats = ref<ProjectStat[]>([]);
const loadingProjects = ref(false);
const editingProject = ref<string | null>(null);
const editingName = ref('');
const savingProject = ref(false);
const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

const missedTypeRecords = computed(() =>
  missedTypes.value.reduce((sum, item) => sum + item.record_count, 0),
);

const activeProject = computed(() => {
  if (filters.value.module === NONE_PROJECT) return UNSPECIFIED_PROJECT;
  return filters.value.module;
});

function currentFilters() {
  return {
    startDate: filters.value.startDate || undefined,
    endDate: filters.value.endDate || undefined,
    module: filters.value.module || undefined,
  };
}

function renderChart() {
  if (!chart) return;
  chart.setOption({
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        radius: '95%',
        center: ['50%', '62%'],
        progress: {
          show: true,
          width: 16,
          itemStyle: { color: stats.value.rate > 0.3 ? '#dc2626' : '#2563eb' },
        },
        axisLine: { lineStyle: { width: 16, color: [[1, '#e2e8f0']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, 0],
          fontSize: 30,
          fontWeight: 'bold',
          formatter: (value: number) => `${value.toFixed(1)}%`,
          color: '#1e293b',
        },
        title: { offsetCenter: [0, '32%'], fontSize: 13, color: '#64748b' },
        data: [{ value: Number((stats.value.rate * 100).toFixed(1)), name: '问题遗漏率' }],
      },
    ],
  });
}

async function load() {
  loading.value = true;
  try {
    stats.value = await statsApi.omission(currentFilters());
    renderChart();
    if (showMissed.value) {
      await loadMissed();
    }
    await loadProjects();
  } catch (error) {
    notify((error as Error).message, 'error');
  } finally {
    loading.value = false;
  }
}

async function loadProjects() {
  loadingProjects.value = true;
  try {
    projectStats.value = await statsApi.byProject({
      startDate: filters.value.startDate || undefined,
      endDate: filters.value.endDate || undefined,
    });
  } catch (error) {
    notify((error as Error).message, 'error');
  } finally {
    loadingProjects.value = false;
  }
}

function selectProject(project: string) {
  if (project === '') {
    filters.value.module = '';
  } else if (project === UNSPECIFIED_PROJECT) {
    filters.value.module = NONE_PROJECT;
  } else {
    filters.value.module = project;
  }
  load();
}

function startRename(item: ProjectStat) {
  editingProject.value = item.project;
  editingName.value = item.project === UNSPECIFIED_PROJECT ? '' : item.project;
}

function cancelRename() {
  editingProject.value = null;
  editingName.value = '';
}

async function confirmRename(item: ProjectStat) {
  const to = editingName.value.trim();
  if (!to) {
    notify('项目名称不能为空', 'error');
    return;
  }
  if (to === item.project) {
    cancelRename();
    return;
  }
  if (to === UNSPECIFIED_PROJECT) {
    notify(`不能使用「${UNSPECIFIED_PROJECT}」作为项目名称`, 'error');
    return;
  }
  const from = item.project === UNSPECIFIED_PROJECT ? null : item.project;
  savingProject.value = true;
  try {
    const result = await issueApi.renameModule({ from, to });
    notify(
      result.merged
        ? `已将「${item.project}」合并到「${to}」，共更新 ${result.changed} 条记录`
        : `已将「${item.project}」重命名为「${to}」，共更新 ${result.changed} 条记录`,
    );
    const activeKey = item.project === UNSPECIFIED_PROJECT ? NONE_PROJECT : item.project;
    if (filters.value.module === activeKey) {
      filters.value.module = to;
    }
    cancelRename();
    modules.value = await issueApi.modules();
    await load();
  } catch (error) {
    notify((error as Error).message, 'error');
  } finally {
    savingProject.value = false;
  }
}

async function loadMissed() {
  loadingMissed.value = true;
  try {
    missedTypes.value = await statsApi.missedTypes(currentFilters());
  } catch (error) {
    notify((error as Error).message, 'error');
  } finally {
    loadingMissed.value = false;
  }
}

async function toggleMissed() {
  if (showMissed.value) {
    showMissed.value = false;
    return;
  }
  showMissed.value = true;
  await loadMissed();
}

async function saveNote(item: MissedType) {
  try {
    await issueTypeApi.updateNote(item.issue_type_id, { cause: item.cause, action: item.action });
    notify(`已保存「${item.issue_type_name}」的原因定位与改进措施`);
  } catch (error) {
    notify((error as Error).message, 'error');
  }
}

function resetFilters() {
  filters.value = { startDate: '', endDate: '', module: '' };
  load();
}

onMounted(async () => {
  if (chartEl.value) {
    chart = echarts.init(chartEl.value);
  }
  try {
    modules.value = await issueApi.modules();
  } catch {
    modules.value = [];
  }
  await load();
  window.addEventListener('resize', resizeChart);
});

function resizeChart() {
  chart?.resize();
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart);
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div class="panel">
    <h2>统计筛选</h2>
    <div class="row">
      <div class="field">
        <label>开始日期</label>
        <input v-model="filters.startDate" type="date" />
      </div>
      <div class="field">
        <label>结束日期</label>
        <input v-model="filters.endDate" type="date" />
      </div>
      <div class="field">
        <label>项目</label>
        <select v-model="filters.module">
          <option value="">全部项目</option>
          <option :value="NONE_PROJECT">未标注项目</option>
          <option v-for="item in modules" :key="item" :value="item">{{ item }}</option>
        </select>
      </div>
      <button class="primary" :disabled="loading" @click="load">查询</button>
      <button :disabled="loading" @click="resetFilters">重置</button>
    </div>
  </div>

  <div class="cards">
    <div class="card">
      <div class="card-label">测试验证问题类型数 A</div>
      <div class="card-value">{{ stats.a }}</div>
    </div>
    <div class="card">
      <div class="card-label">客户端问题类型数 C（原始分类去重）</div>
      <div class="card-value">{{ stats.clientTotal }}</div>
    </div>
    <div
      class="card clickable"
      :class="{ active: showMissed }"
      role="button"
      tabindex="0"
      @click="toggleMissed"
      @keydown.enter.prevent="toggleMissed"
      @keydown.space.prevent="toggleMissed"
    >
      <div class="card-label">客户端未测出问题类型数 B</div>
      <div class="card-value danger-text">{{ stats.b }}</div>
      <div class="card-hint">{{ showMissed ? '点击收起明细' : '点击查看明细' }}</div>
    </div>
    <div class="card">
      <div class="card-label">重叠类型数</div>
      <div class="card-value">{{ stats.overlap }}</div>
    </div>
    <div class="card">
      <div class="card-label">待分类记录数</div>
      <div class="card-value warn-text">{{ stats.pending }}</div>
    </div>
    <div class="card">
      <div class="card-label">问题遗漏率</div>
      <div class="card-value">{{ percent(stats.rate) }}</div>
    </div>
  </div>

  <div v-if="stats.pending > 0" class="pending-tip">
    还有 {{ stats.pending }} 条记录处于「待分类」，未参与统计。请到「分类校对」页完成分类后结果更准确。
  </div>

  <div v-if="showMissed" class="panel">
    <div class="panel-head">
      <h2>客户端未测出问题类型 B（{{ missedTypes.length }} 类 / {{ missedTypeRecords }} 条记录）</h2>
      <button @click="showMissed = false">收起</button>
    </div>
    <p class="hint">
      以下问题类型在客户端出现过，但测试验证未测出，是遗漏的主要来源；可直接填写原因定位与改进措施，失焦即保存。
    </p>
    <table>
      <thead>
        <tr>
          <th style="width: 180px">问题类型</th>
          <th style="width: 90px">客户端记录数</th>
          <th>示例问题描述（最多 3 条）</th>
          <th style="width: 220px">问题原因定位</th>
          <th style="width: 220px">改进措施</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loadingMissed">
          <td colspan="5" class="empty">加载中…</td>
        </tr>
        <tr v-else-if="!missedTypes.length">
          <td colspan="5" class="empty">当前没有未测出的问题类型</td>
        </tr>
        <tr v-for="item in missedTypes" :key="item.issue_type_id">
          <td>{{ item.issue_type_name }}</td>
          <td>{{ item.record_count }}</td>
          <td class="samples">
            <span v-for="(sample, index) in item.samples" :key="index">{{ sample }}</span>
          </td>
          <td>
            <textarea
              v-model="item.cause"
              class="note-input"
              rows="2"
              placeholder="填写原因定位"
              @change="saveNote(item)"
            ></textarea>
          </td>
          <td>
            <textarea
              v-model="item.action"
              class="note-input"
              rows="2"
              placeholder="填写改进措施"
              @change="saveNote(item)"
            ></textarea>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="panel">
    <div class="panel-head">
      <h2>分项目统计</h2>
      <button v-if="filters.module" class="small" @click="selectProject('')">返回全部项目</button>
      <span v-else class="hint">点击某行可按该项目下钻；点击「重命名」可修改项目名称</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>项目</th>
          <th style="width: 70px">A</th>
          <th style="width: 70px">B</th>
          <th style="width: 80px">重叠</th>
          <th style="width: 100px">遗漏率</th>
          <th style="width: 150px">客户端问题类型数 C</th>
          <th style="width: 90px">待分类</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loadingProjects">
          <td colspan="7" class="empty">加载中…</td>
        </tr>
        <tr v-else-if="!projectStats.length">
          <td colspan="7" class="empty">暂无项目数据，请在导入时映射「项目」列</td>
        </tr>
        <tr
          v-for="item in projectStats"
          :key="item.project"
          class="clickable-row"
          :class="{ active: activeProject === item.project }"
          @click="selectProject(item.project)"
        >
          <td @click.stop>
            <template v-if="editingProject === item.project">
              <div class="rename-box">
                <input
                  v-model="editingName"
                  class="rename-input"
                  autofocus
                  placeholder="输入项目名称"
                  @keydown.enter.prevent="confirmRename(item)"
                  @keydown.esc="cancelRename"
                />
                <button class="small primary" :disabled="savingProject" @click="confirmRename(item)">
                  保存
                </button>
                <button class="small" :disabled="savingProject" @click="cancelRename">取消</button>
              </div>
            </template>
            <template v-else>
              <span>{{ item.project }}</span>
              <button class="rename-link" @click="startRename(item)">重命名</button>
            </template>
          </td>
          <td>{{ item.a }}</td>
          <td>{{ item.b }}</td>
          <td>{{ item.overlap }}</td>
          <td>{{ percent(item.rate) }}</td>
          <td>{{ item.clientTotal }}</td>
          <td>{{ item.pending }}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="panel">
    <h2>遗漏率</h2>
    <div ref="chartEl" class="chart"></div>
    <p v-if="stats.empty" class="empty">当前无有效数据，A + B = 0</p>
    <p class="formula">
      遗漏率 = B / (A + B) = {{ stats.b }} / ({{ stats.a }} + {{ stats.b }}) =
      {{ percent(stats.rate) }}
    </p>
    <p class="formula">
      客户端问题类型数 C = 客户端原始「问题分类」去重数 = {{ stats.clientTotal }}（反映原始数据，不参与遗漏率计算）
    </p>
  </div>
</template>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

@media (max-width: 980px) {
  .cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 18px;
}

.card.clickable {
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.card.clickable:hover,
.card.clickable.active {
  border-color: var(--danger);
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.12);
}

.card-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.panel-head h2 {
  margin: 0;
}

.hint {
  color: var(--muted);
  font-size: 13px;
  margin: 0 0 12px;
}

.samples {
  display: flex;
  flex-direction: column;
  gap: 4px;
  white-space: normal;
  color: #334155;
  font-size: 13px;
}

.note-input {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 40px;
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: #0f172a;
}

.note-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.clickable-row {
  cursor: pointer;
}

.rename-box {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rename-input {
  flex: 1;
  min-width: 120px;
  padding: 5px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
}

.rename-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.rename-link {
  margin-left: 8px;
  padding: 0;
  border: none;
  background: none;
  color: #2563eb;
  font-size: 12px;
  cursor: pointer;
}

.rename-link:hover {
  text-decoration: underline;
}

.clickable-row:hover {
  background: #f8fafc;
}

.clickable-row.active {
  background: #eff6ff;
  font-weight: 600;
}

.card-label {
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 8px;
}

.card-value {
  font-size: 28px;
  font-weight: 700;
}

.danger-text {
  color: var(--danger);
}

.warn-text {
  color: var(--warning);
}

.pending-tip {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #b45309;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
  font-size: 13px;
}

.chart {
  height: 280px;
}

.formula {
  text-align: center;
  color: var(--muted);
  margin: 4px 0 0;
}
</style>
