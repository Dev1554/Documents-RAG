import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Documents RAG API is running' });
});

app.use('/api', routes);

app.use(errorHandler);

export default app;
