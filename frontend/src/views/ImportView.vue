<script setup lang="ts">
import { onMounted, ref } from 'vue';
import ImportPanel from '../components/ImportPanel.vue';
import { issueApi } from '../api';
import { notify } from '../composables/useMessage';
import type { IssueSummary } from '../types';

const summary = ref<IssueSummary>({
  client: { total: 0, pending: 0 },
  test: { total: 0, pending: 0 },
});

async function loadSummary() {
  try {
    summary.value = await issueApi.summary();
  } catch (error) {
    notify((error as Error).message, 'error');
  }
}

onMounted(loadSummary);
</script>

<template>
  <div class="panel">
    <h2>导入流程</h2>
    <p class="desc">
      先上传「客户端问题表」与「测试验证问题表」，将某一列映射为「问题描述」，工具会依据
      <strong>问题类型字典中的关键词规则</strong> 自动分类；未能命中的问题会进入「待分类」，可在
      <strong>分类校对</strong> 页人工指定类型，最后在 <strong>统计看板</strong> 查看遗漏率。
    </p>
    <div class="stats">
      <span>客户端：共 {{ summary.client.total }} 条，待分类 {{ summary.client.pending }} 条</span>
      <span>测试验证：共 {{ summary.test.total }} 条，待分类 {{ summary.test.pending }} 条</span>
      <button class="small" @click="loadSummary">刷新统计</button>
    </div>
  </div>

  <div class="panels">
    <ImportPanel source="client" @imported="loadSummary" />
    <ImportPanel source="test" @imported="loadSummary" />
  </div>
</template>

<style scoped>
.desc {
  color: var(--muted);
  line-height: 1.7;
  margin: 0 0 12px;
}

.stats {
  display: flex;
  gap: 22px;
  align-items: center;
  flex-wrap: wrap;
  color: var(--text);
}

.panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 1100px) {
  .panels {
    grid-template-columns: 1fr;
  }
}
</style>
