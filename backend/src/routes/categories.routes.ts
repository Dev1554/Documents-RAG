import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { listCategories, createCategory, deleteCategory } from '../services/category.service';
import { AuthRequest } from '../types';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const categories = await listCategories(req.user!.id);
    res.json({ success: true, data: categories });
  })
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({ name: z.string().min(2).max(50) });
    const { name } = schema.parse(req.body);
    const category = await createCategory(req.user!.id, name);
    res.status(201).json({ success: true, data: category });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await deleteCategory(req.user!.id, String(req.params.id));
    res.json({ success: true, data: result });
  })
);

export default router;
