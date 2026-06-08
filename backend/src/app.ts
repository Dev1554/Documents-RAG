import express from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const uploadPath = path.resolve(process.cwd(), env.uploadDir);
app.use('/uploads', express.static(uploadPath));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Documents RAG API is running' });
});

app.use('/api', routes);

app.use(errorHandler);

export default app;
