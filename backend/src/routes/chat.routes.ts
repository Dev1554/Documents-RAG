import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { AuthRequest, DocumentFilters } from '../types';
import { askQuestion, getChatHistory } from '../services/rag.service';

const router = Router();
router.use(authenticate);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      question: z.string().min(1).max(2000),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const filters: DocumentFilters = {};

    if (data.category) filters.category = data.category;
    if (data.tags) filters.tags = data.tags;
    if (data.dateFrom) filters.dateFrom = new Date(data.dateFrom);
    if (data.dateTo) filters.dateTo = new Date(data.dateTo);

    const result = await askQuestion(req.user!.id, data.question, filters);
    res.json({ success: true, data: result });
  })
);

router.get(
  '/history',
  asyncHandler(async (req: AuthRequest, res) => {
    const history = await getChatHistory(req.user!.id);
    res.json({ success: true, data: history });
  })
);

export default router;
