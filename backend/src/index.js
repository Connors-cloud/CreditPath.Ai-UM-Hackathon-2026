import './config/env.js';
import express from 'express';
import { env } from './config/env.js';
import { log } from './utils/logger.js';
import { runMigrations } from './db/migrate.js';
import { startFollowupScheduler } from './services/followupService.js';
import { requestLogger } from './api/middleware/requestLogger.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { publicRouter } from './api/routes/publicRoutes.js';
import { authRouter } from './api/routes/authRoutes.js';
import { studentRouter } from './api/routes/studentRoutes.js';
import { lecturerRouter } from './api/routes/lecturerRoutes.js';
import { uploadRouter } from './api/routes/uploadRoutes.js';
import { analysisRouter } from './api/routes/analysisRoutes.js';
import { applicationRouter } from './api/routes/applicationRoutes.js';

runMigrations();
startFollowupScheduler();

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(requestLogger);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api/public', publicRouter);
app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/analyses', analysisRouter);
app.use('/api/student', studentRouter);
app.use('/api/lecturer', lecturerRouter);
app.use('/api', applicationRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  log.info({ port: env.PORT, env: env.NODE_ENV }, 'Backend server started');
});

export { app };
