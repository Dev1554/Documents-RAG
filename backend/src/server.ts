import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { ensureQdrantCollection } from './services/qdrant.service';
import { seedDefaultCategories } from './services/category.service';
import fs from 'fs';
import path from 'path';

async function bootstrap() {
  const uploadPath = path.resolve(process.cwd(), env.uploadDir);
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  await connectDB();
  await seedDefaultCategories();

  try {
    await ensureQdrantCollection();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      'Qdrant connection failed. Vector search and AI chat require Qdrant.\n' +
        '1. Start Docker Desktop\n' +
        '2. Run: docker compose up -d\n' +
        '3. Restart the backend\n' +
        `Details: ${message}`
    );
    process.exit(1);
  }

  app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
