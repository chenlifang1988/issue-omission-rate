<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { issueTypeApi } from '../api';
import { notify } from '../composables/useMessage';
import type { IssueType } from '../types';

const types = ref<IssueType[]>([]);
const loading = ref(false);
const newName = ref('');
const newKeywordInput = reactive<Record<number, string>>({});
const editingId = ref<number | null>(null);
const editingName = ref('');

async function load() {
  loading.value = true;
  try {
    types.value = await issueTypeApi.list();
  } catch (error) {
    notify((error as Error).message, 'error');
  } finally {
    loading.value = false;
  }
}

async function addType() {
  const name = newName.value.trim();
  if (!name) {
    notify('请输入问题类型名称', 'error');
    return;
  }
  try {
    await issueTypeApi.create(name);
    newName.value = '';
    notify('新增成功');
    await load();
  } catch (error) {
    notify((error as Error).message, 'error');
  }
}

function startEdit(type: IssueType) {
  editingId.value = type.id;
  editingName.value = type.name;
}

function cancelEdit() {
  editingId.value = null;
  editingName.value = '';
}

async function saveEdit(type: IssueType) {
  const name = editingName.value.trim();
  if (!name) {
    notify('名称不能为空', 'error');
    return;
  }
  try {
    await issueTypeApi.update(type.id, { name });
    cancelEdit();
    notify('已保存');
    await load();
  } catch (error) {
    notify((error as Error).message, 'error');
  }
}

async function toggle(type: IssueType) {
  try {
    await issueTypeApi.update(type.id, { enabled: !type.enabled });
    await load();
  } catch (error) {
    notify((error as Error).message, 'error');
  }
}

async function remove(type: IssueType) {
  if (!window.confirm(`确定删除问题类型「${type.name}」吗？`)) return;
  try {
    await issueTypeApi.remove(type.id);
    notify('已删除');
    await load();
  } catch (error) {
    notify((error as Error).message, 'error');
  }
}

async function addKeyword(type: IssueType) {
  const keyword = (newKeywordInput[type.id] || '').trim();
  if (!keyword) {
    notify('请输入关键词', 'error');
    return;
  }
  try {
    await issueTypeApi.addRule(type.id, keyword);
    newKeywordInput[type.id] = '';
    await load();
  } catch (error) {
    notify((error as Error).message, 'error');
  }
}

async function removeKeyword(ruleId: number) {
  try {
    await issueTypeApi.removeRule(ruleId);
    await load();
  } catch (error) {
    notify((error as Error).message, 'error');
  }
}

onMounted(load);
</script>

<template>
  <div class="panel">
    <h2>新增问题类型</h2>
    <div class="row">
      <div class="field">
        <label>类型名称</label>
        <input
          v-model="newName"
          placeholder="例如：登录异常"
          style="width: 240px"
          @keyup.enter="addType"
        />
      </div>
      <button class="primary" @click="addType">新增</button>
    </div>
    <p class="hint">类型名称本身会作为隐式关键词参与自动分类，还可为每个类型补充更多关键词。</p>
  </div>

  <div class="panel">
    <div class="toolbar">
      <h2 style="margin: 0">问题类型字典（共 {{ types.length }} 项）</h2>
      <button :disabled="loading" @click="load">刷新</button>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 50px">ID</th>
          <th style="width: 200px">名称</th>
          <th style="width: 80px">状态</th>
          <th>关键词规则</th>
          <th style="width: 200px">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="type in types" :key="type.id">
          <td>{{ type.id }}</td>
          <td>
            <input
              v-if="editingId === type.id"
              v-model="editingName"
              style="width: 160px"
              @keyup.enter="saveEdit(type)"
              @keyup.esc="cancelEdit"
            />
            <span v-else>{{ type.name }}</span>
          </td>
          <td>
            <span class="tag" :class="{ off: !type.enabled }">
              {{ type.enabled ? '启用' : '停用' }}
            </span>
          </td>
          <td>
            <div class="rules">
              <span v-for="rule in type.rules" :key="rule.id" class="rule-chip">
                {{ rule.keyword }}
                <button class="chip-close" title="删除关键词" @click="removeKeyword(rule.id)">×</button>
              </span>
              <span v-if="!type.rules.length" class="no-rule">暂无关键词</span>
            </div>
            <div class="add-rule">
              <input
                v-model="newKeywordInput[type.id]"
                placeholder="新增关键词"
                style="width: 130px"
                @keyup.enter="addKeyword(type)"
              />
              <button class="small" @click="addKeyword(type)">添加</button>
            </div>
          </td>
          <td>
            <template v-if="editingId === type.id">
              <button class="small primary" @click="saveEdit(type)">保存</button>
              <button class="small" style="margin-left: 6px" @click="cancelEdit">取消</button>
            </template>
            <template v-else>
              <button class="small" @click="startEdit(type)">重命名</button>
              <button class="small" style="margin-left: 6px" @click="toggle(type)">
                {{ type.enabled ? '停用' : '启用' }}
              </button>
              <button class="small danger" style="margin-left: 6px" @click="remove(type)">删除</button>
            </template>
          </td>
        </tr>
        <tr v-if="!types.length">
          <td colspan="5" class="empty">暂无问题类型，请先新增</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.hint {
  color: var(--muted);
  font-size: 13px;
  margin: 10px 0 0;
}

.rules {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.rule-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #eff6ff;
  color: var(--primary);
  border-radius: 999px;
  padding: 2px 6px 2px 10px;
  font-size: 12px;
}

.chip-close {
  border: none;
  background: transparent;
  color: var(--primary);
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}

.chip-close:hover {
  color: var(--danger);
}

.no-rule {
  color: var(--muted);
  font-size: 12px;
}

.add-rule {
  display: flex;
  gap: 6px;
  align-items: center;
}
</style>
