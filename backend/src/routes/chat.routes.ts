import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { AuthRequest, DocumentFilters } from '../types';
import { askQuestion, getChatHistory } from '../services/rag.service';
import { ChatHistory } from '../models/ChatHistory';
import { AppError } from '../utils/AppError';

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
      chatId: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const filters: DocumentFilters = {};

    if (data.category) filters.category = data.category;
    if (data.tags) filters.tags = data.tags;
    if (data.dateFrom) filters.dateFrom = new Date(data.dateFrom);
    if (data.dateTo) filters.dateTo = new Date(data.dateTo);

    const result = await askQuestion(req.user!.id, data.question, filters, data.chatId);
    res.json({ success: true, data: result });
  })
);

router.get(
  '/history',
  asyncHandler(async (req: AuthRequest, res) => {
    const includeArchived = req.query.includeArchived === 'true' || req.query.includeArchived === '1';
    const history = await getChatHistory(req.user!.id, 100, includeArchived);
    res.json({ success: true, data: history });
  })
);

router.patch(
  '/history/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      isPinned: z.boolean().optional(),
      isArchived: z.boolean().optional(),
    });

    const data = schema.parse(req.body);
    const chat = await ChatHistory.findOne({ _id: req.params.id, userId: req.user!.id });

    if (!chat) {
      throw new AppError('Chat history item not found', 404);
    }

    if (data.isPinned !== undefined) {
      chat.isPinned = data.isPinned;
      chat.pinnedAt = data.isPinned ? new Date() : undefined;
    }

    if (data.isArchived !== undefined) {
      chat.isArchived = data.isArchived;
      chat.archivedAt = data.isArchived ? new Date() : undefined;
      if (data.isArchived) {
        chat.isPinned = false;
        chat.pinnedAt = undefined;
      }
    }

    await chat.save();
    res.json({ success: true, data: chat });
  })
);

router.delete(
  '/history/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const deleted = await ChatHistory.findOneAndDelete({
      _id: req.params.id,
      userId: req.user!.id,
    });

    if (!deleted) {
      throw new AppError('Chat history item not found', 404);
    }

    res.json({ success: true, data: { message: 'Chat deleted' } });
  })
);

export default router;
