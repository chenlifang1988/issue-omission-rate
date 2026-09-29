# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[Project Knowledge Summary]
- Date: 2026-09-28
- Context: Discovered by Agent while building the 问题遗漏率统计工具
- Category: Build Methods
- Instructions:
  - 根目录 `npm run dev` 同时启动后端（3001）与前端（5173）。
  - 后端单元测试：根目录 `npm test`（即 `node --test`，位于 `backend/test/`）。
  - 前端类型检查与构建：`npm run build`（`vue-tsc -b && vite build`），构建属编译类任务，应使用后台终端执行。
  - 单独启动后端：`npm --prefix backend run dev`；单独启动前端：`npm --prefix frontend run dev`。

[Project Knowledge Summary]
- Date: 2026-09-28
- Context: Discovered by Agent while building the 问题遗漏率统计工具
- Category: Environment Configuration
- Instructions:
  - SQLite 数据库默认位于 `backend/data/omission.db`，可用环境变量 `DB_DIR` / `DB_PATH` 覆盖。
  - 字典为空时后端启动会写入默认分类（定义见 `backend/src/services/dictionary.js`）；重建字典（清空字典与问题数据）：`cd backend && node scripts/init-dictionary.js --reset`。
   - 前端通过 Vite 代理把 `/api` 转发到 `http://localhost:3001`。

[Project Knowledge Summary]
- Date: 2026-09-29
- Context: Discovered by Agent while pushing to GitHub
- Category: Operations & Deployment
- Instructions:
  - 代码托管远端：`https://github.com/chenlifang1988/issue-omission-rate`（Public），默认分支 `main`，本地已设 `main -> origin/main` upstream。
  - 推送：`git push origin main`（HTTPS，需要具备 `repo` 权限的 GitHub Token；环境默认无持久凭据）。
  - 仓库已忽略 `node_modules/` 与 `backend/data/`（运行时 SQLite 不入库）。
