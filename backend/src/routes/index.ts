import { Router } from 'express';
import authRoutes from './auth.routes';
import categoriesRoutes from './categories.routes';
import documentsRoutes from './documents.routes';
import searchRoutes from './search.routes';
import chatRoutes from './chat.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/categories', categoriesRoutes);
router.use('/documents', documentsRoutes);
router.use('/search', searchRoutes);
router.use('/chat', chatRoutes);

export default router;
