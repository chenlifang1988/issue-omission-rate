import express from 'express';
import multer from 'multer';
import issueTypesRouter from './routes/issueTypes.js';
import issuesRouter from './routes/issues.js';
import importsRouter from './routes/imports.js';
import statsRouter from './routes/stats.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/issue-types', issueTypesRouter);
  app.use('/api/issues', issuesRouter);
  app.use('/api/imports', importsRouter);
  app.use('/api/stats', statsRouter);

  app.use((req, res) => {
    res.status(404).json({ error: '接口不存在' });
  });

  app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || '服务器内部错误' });
  });

  return app;
}

export default createApp;
