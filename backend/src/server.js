import { createApp } from './app.js';
import { ensureDictionarySeeded } from './services/dictionarySeed.js';

const port = Number(process.env.PORT || 3001);
const seeded = ensureDictionarySeeded();
if (seeded) {
  console.log('[backend] 已写入中粒度分类字典');
}
const app = createApp();

app.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
});
