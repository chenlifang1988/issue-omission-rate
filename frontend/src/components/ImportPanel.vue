<script setup lang="ts">
import { computed, ref } from 'vue';
import { importApi } from '../api';
import { notify } from '../composables/useMessage';
import { SOURCE_LABEL } from '../types';
import type { ImportMapping, ImportResult, ImportRow, Source } from '../types';

const props = defineProps<{ source: Source }>();
const emit = defineEmits<{ (event: 'imported'): void }>();

const fileInput = ref<HTMLInputElement | null>(null);
const fileName = ref('');
const headers = ref<string[]>([]);
const rows = ref<ImportRow[]>([]);
const total = ref(0);
const parsing = ref(false);
const importing = ref(false);
const mode = ref<'replace' | 'append'>('replace');
const result = ref<ImportResult | null>(null);

const mapping = ref<ImportMapping>({ description: '', classification: '', module: '', occurredDate: '' });

const previewRows = computed(() => rows.value.slice(0, 10));
const canImport = computed(() => !!mapping.value.description && rows.value.length > 0);
const isClient = computed(() => props.source === 'client');

function guessMapping(headerList: string[]) {
  const pick = (pattern: RegExp) => headerList.find((header) => pattern.test(header)) || '';
  mapping.value = {
    description: pick(/描述|问题|现象|标题|内容|说明|desc|issue/i),
    classification: pick(/分类|类别|类型|category|class/i),
    module: pick(/项目|项目名称|模块|模块名|功能|系统|project|module/i),
    occurredDate: pick(/日期|时间|date/i),
  };
}

async function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    notify('仅支持 .xlsx / .xls / .csv 文件', 'error');
    return;
  }
  parsing.value = true;
  result.value = null;
  try {
    const data = await importApi.preview(file);
    headers.value = data.headers;
    rows.value = data.rows;
    total.value = data.total;
    fileName.value = file.name;
    guessMapping(data.headers);
    if (!data.rows.length) {
      notify('文件中没有可导入的数据行', 'error');
    }
  } catch (error) {
    notify((error as Error).message, 'error');
    headers.value = [];
    rows.value = [];
  } finally {
    parsing.value = false;
  }
}

async function commit() {
  if (!mapping.value.description) {
    notify('请先映射问题描述列', 'error');
    return;
  }
  importing.value = true;
  try {
    const data = await importApi.commit({
      source: props.source,
      mapping: mapping.value,
      rows: rows.value,
      mode: mode.value,
    });
    result.value = data;
    notify(
      `${SOURCE_LABEL[props.source]}导入成功 ${data.success} 条，待分类 ${data.pending} 条`,
      data.failed ? 'error' : 'success',
    );
    emit('imported');
  } catch (error) {
    notify((error as Error).message, 'error');
  } finally {
    importing.value = false;
  }
}

function reset() {
  if (fileInput.value) fileInput.value.value = '';
  fileName.value = '';
  headers.value = [];
  rows.value = [];
  total.value = 0;
  result.value = null;
  mapping.value = { description: '', classification: '', module: '', occurredDate: '' };
}

function cellValue(row: ImportRow, header: string) {
  const value = row[header];
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value === undefined || value === null ? '' : String(value);
}
</script>

<template>
  <div class="panel import-panel">
    <div class="panel-head">
      <h2>
        <span class="tag" :class="{ client: isClient }">{{ SOURCE_LABEL[source] }}</span>
        问题表
      </h2>
      <button v-if="fileName" class="small" @click="reset">清空</button>
    </div>

    <div class="field">
      <label>选择文件（.xlsx / .xls / .csv）</label>
      <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" :disabled="parsing" @change="onFileChange" />
    </div>

    <p v-if="parsing" class="hint">正在解析文件…</p>
    <p v-if="fileName" class="hint">
      已解析「{{ fileName }}」，共 {{ total }} 行{{ total > 10 ? '（预览前 10 行）' : '' }}
    </p>

    <template v-if="headers.length">
      <div class="mapping">
        <div class="field">
          <label>问题描述 *</label>
          <select v-model="mapping.description">
            <option value="">请选择列</option>
            <option v-for="header in headers" :key="header" :value="header">{{ header }}</option>
          </select>
        </div>
        <div class="field">
          <label>分类列（可选）</label>
          <select v-model="mapping.classification">
            <option value="">无（按描述自动分类）</option>
            <option v-for="header in headers" :key="header" :value="header">{{ header }}</option>
          </select>
          <span class="field-hint">若表中已有分类，将优先按该列归类</span>
        </div>
        <div class="field">
          <label>项目（可选）</label>
          <select v-model="mapping.module">
            <option value="">不导入</option>
            <option v-for="header in headers" :key="header" :value="header">{{ header }}</option>
          </select>
          <span class="field-hint">用于按项目分别统计，两张表请映射同一个项目列</span>
        </div>
        <div class="field">
          <label>发生日期</label>
          <select v-model="mapping.occurredDate">
            <option value="">不导入</option>
            <option v-for="header in headers" :key="header" :value="header">{{ header }}</option>
          </select>
        </div>
      </div>

      <div class="preview">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th v-for="header in headers" :key="header">{{ header }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in previewRows" :key="index">
              <td>{{ row.__rowNumber || index + 2 }}</td>
              <td v-for="header in headers" :key="header">{{ cellValue(row, header) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="actions">
        <label class="mode">
          <input v-model="mode" type="radio" value="replace" />
          导入前清空该来源中相同项目的数据
        </label>
        <label class="mode">
          <input v-model="mode" type="radio" value="append" />
          追加导入
        </label>
        <button class="primary" :disabled="!canImport || importing" @click="commit">
          {{ importing ? '导入中…' : `导入 ${total} 行` }}
        </button>
      </div>
    </template>

    <div v-if="result" class="result">
      <div class="result-row">
        <span>成功 <b>{{ result.success }}</b></span>
        <span>自动分类 <b>{{ result.auto }}</b></span>
        <span :class="{ danger: result.pending > 0 }">待分类 <b>{{ result.pending }}</b></span>
        <span>失败 <b>{{ result.failed }}</b></span>
        <span v-if="result.replaced">已清空相同项目旧数据 {{ result.replaced }} 条</span>
      </div>
      <table v-if="result.errors.length">
        <thead>
          <tr>
            <th style="width: 80px">行号</th>
            <th>失败原因</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(error, index) in result.errors.slice(0, 20)" :key="index">
            <td>{{ error.rowNumber }}</td>
            <td>{{ error.reason }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="result.errors.length > 20" class="hint">
        仅展示前 20 条失败原因，共 {{ result.errors.length }} 条。
      </p>
    </div>
  </div>
</template>

<style scoped>
.import-panel {
  min-width: 0;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-head h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint {
  color: var(--muted);
  font-size: 13px;
  margin: 10px 0 0;
}

.mapping {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.field-hint {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}

.preview {
  overflow: auto;
  max-height: 240px;
  margin-top: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 14px;
}

.mode {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}

.mode input {
  width: auto;
}

.result {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--border);
}

.result-row {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.result-row b {
  font-size: 16px;
}

.danger {
  color: var(--danger);
}
</style>
