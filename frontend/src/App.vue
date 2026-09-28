<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { computed } from 'vue';
import { toast } from './composables/useMessage';

const route = useRoute();
const title = computed(() => (route.meta.title as string) || '问题遗漏率统计工具');
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">漏</div>
        <div>
          <div class="brand-title">问题遗漏率</div>
          <div class="brand-sub">统计工具</div>
        </div>
      </div>
      <nav>
        <RouterLink to="/import">批量导入</RouterLink>
        <RouterLink to="/classify">分类校对</RouterLink>
        <RouterLink to="/types">问题类型字典</RouterLink>
        <RouterLink to="/dashboard">统计看板</RouterLink>
      </nav>
    </aside>
    <main class="content">
      <header class="topbar">
        <h1>{{ title }}</h1>
      </header>
      <RouterView />
    </main>
    <transition name="fade">
      <div v-if="toast" class="toast" :class="toast.type">{{ toast.text }}</div>
    </transition>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 220px;
  background: #0f172a;
  color: #cbd5e1;
  padding: 20px 14px;
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 26px;
  padding: 0 6px;
}

.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: var(--primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
}

.brand-title {
  color: #fff;
  font-weight: 600;
}

.brand-sub {
  font-size: 12px;
  color: #94a3b8;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

nav a {
  color: #cbd5e1;
  text-decoration: none;
  padding: 9px 12px;
  border-radius: 7px;
  font-size: 14px;
}

nav a:hover {
  background: #1e293b;
  color: #fff;
}

nav a.router-link-active {
  background: var(--primary);
  color: #fff;
}

.content {
  flex: 1;
  padding: 22px 26px;
  min-width: 0;
}

.topbar h1 {
  margin: 0 0 18px;
  font-size: 20px;
}

.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 10px 18px;
  border-radius: 8px;
  color: #fff;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.2);
  z-index: 1000;
}

.toast.success {
  background: var(--success);
}

.toast.error {
  background: var(--danger);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
