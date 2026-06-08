import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { AuthRequest, DocumentFilters } from '../types';
import { keywordSearch, semanticSearch, hybridSearch } from '../services/search.service';

const router = Router();
router.use(authenticate);

function parseFilters(query: Record<string, unknown>): DocumentFilters {
  const filters: DocumentFilters = {};

  if (typeof query.category === 'string' && query.category.trim()) {
    filters.category = query.category.trim();
  }
  if (typeof query.tags === 'string' && query.tags.trim()) {
    filters.tags = query.tags.split(',').map((t) => t.trim()).filter(Boolean);
  }
  if (typeof query.dateFrom === 'string') {
    filters.dateFrom = new Date(query.dateFrom);
  }
  if (typeof query.dateTo === 'string') {
    filters.dateTo = new Date(query.dateTo);
  }

  return filters;
}

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      q: z.string().min(1),
      type: z.enum(['keyword', 'semantic', 'hybrid']).default('hybrid'),
      category: z.string().optional(),
      tags: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.coerce.number().min(1).max(50).default(10),
    });

    const params = schema.parse(req.query);
    const filters = parseFilters(req.query as Record<string, unknown>);

    let results;
    switch (params.type) {
      case 'keyword':
        results = await keywordSearch(req.user!.id, { ...filters, keyword: params.q });
        break;
      case 'semantic':
        results = await semanticSearch(req.user!.id, params.q, filters, params.limit);
        break;
      default:
        results = await hybridSearch(req.user!.id, params.q, filters, params.limit);
    }

    res.json({ success: true, data: results });
  })
);

export default router;
