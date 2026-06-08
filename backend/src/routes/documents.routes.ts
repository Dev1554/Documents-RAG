import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { AuthRequest, DocumentFilters } from '../types';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { storageService } from '../services/storage.service';
import { isSupportedMimeType } from '../services/textExtraction.service';
import { DocumentModel } from '../models/Document';
import {
  processDocument,
  listDocuments,
  getDocumentById,
  getRelatedDocuments,
  deleteDocument,
  getDashboardStats,
} from '../services/documentProcessing.service';

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isSupportedMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

function parseFilters(query: Record<string, unknown>): DocumentFilters {
  const filters: DocumentFilters = {};

  if (typeof query.keyword === 'string' && query.keyword.trim()) {
    filters.keyword = query.keyword.trim();
  }
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
  '/stats',
  asyncHandler(async (req: AuthRequest, res) => {
    const stats = await getDashboardStats(req.user!.id);
    res.json({ success: true, data: stats });
  })
);

router.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const schema = z.object({
      category: z.string().min(1),
      tags: z.string().optional(),
    });

    const { category, tags } = schema.parse(req.body);
    const tagList = tags
      ? tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const stored = await storageService.saveFile(req.file, req.user!.id);

    const document = await DocumentModel.create({
      userId: req.user!.id,
      fileName: stored.fileName,
      originalName: req.file.originalname,
      fileUrl: stored.fileUrl,
      filePath: stored.filePath,
      mimeType: stored.mimeType,
      fileSize: stored.size,
      category,
      tags: tagList,
      status: 'pending',
    });

    processDocument(document._id.toString()).catch(console.error);

    res.status(201).json({ success: true, data: document });
  })
);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const documents = await listDocuments(req.user!.id, filters);
    res.json({ success: true, data: documents });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = String(req.params.id);
    const document = await getDocumentById(req.user!.id, id);
    const related = await getRelatedDocuments(
      req.user!.id,
      id,
      document.category,
      document.tags
    );
    res.json({ success: true, data: { document, related } });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await deleteDocument(req.user!.id, String(req.params.id));
    res.json({ success: true, data: result });
  })
);

export default router;
