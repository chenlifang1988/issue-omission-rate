import { createRouter, createWebHashHistory } from 'vue-router';
import DashboardView from './views/DashboardView.vue';
import ClassificationView from './views/IssueRecordView.vue';
import IssueTypeView from './views/IssueTypeView.vue';
import ImportView from './views/ImportView.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/import' },
    { path: '/import', name: 'import', component: ImportView, meta: { title: '批量导入' } },
    { path: '/classify', name: 'classify', component: ClassificationView, meta: { title: '分类校对' } },
    { path: '/types', name: 'types', component: IssueTypeView, meta: { title: '问题类型字典' } },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { title: '统计看板' } },
  ],
});

export default router;
