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
import { updateDocumentVectorsPayload } from '../services/qdrant.service';
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
  if (typeof query.uploadedBy === 'string' && query.uploadedBy.trim()) {
    filters.uploadedBy = query.uploadedBy.trim();
  }
  if (query.year) {
    filters.year = Number(query.year);
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
      title: z.string().optional(),
      documentType: z.string().optional(),
    });

    const { category, tags, title, documentType } = schema.parse(req.body);
    const tagList = tags
      ? tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const defaultTitle = () => {
      const name = req.file!.originalname;
      const base = name.substring(0, name.lastIndexOf('.')) || name;
      return base
        .replace(/[_-]/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    };

    const finalTitle = title?.trim() || defaultTitle();
    const finalDocType = documentType?.trim() || 'Other';
    const ext = req.file.originalname.split('.').pop() || '';
    const fileType = ext.toUpperCase() || 'PDF';

    const stored = await storageService.saveFile(req.file, req.user!.id);

    const document = await DocumentModel.create({
      userId: req.user!.id,
      title: finalTitle,
      documentType: finalDocType,
      uploadedBy: req.user!.name || 'Admin',
      fileType,
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

router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = String(req.params.id);
    const schema = z.object({
      title: z.string().min(1).optional(),
      category: z.string().min(1).optional(),
      tags: z.union([z.array(z.string()), z.string()]).optional(),
      documentType: z.string().min(1).optional(),
    });

    const parsed = schema.parse(req.body);

    const document = await DocumentModel.findOne({ _id: id, userId: req.user!.id });
    if (!document) {
      throw new AppError('Document not found', 404);
    }

    if (parsed.title !== undefined) document.title = parsed.title;
    if (parsed.category !== undefined) document.category = parsed.category;
    if (parsed.documentType !== undefined) document.documentType = parsed.documentType;
    
    let tagList: string[] | undefined;
    if (parsed.tags !== undefined) {
      tagList = Array.isArray(parsed.tags)
        ? parsed.tags
        : parsed.tags.split(',').map((t) => t.trim()).filter(Boolean);
      document.tags = tagList;
    }

    await document.save();

    // Sync updates to Qdrant vector payload
    const qdrantUpdates: Record<string, unknown> = {};
    if (parsed.title !== undefined) qdrantUpdates.documentName = parsed.title;
    if (parsed.documentType !== undefined) qdrantUpdates.documentType = parsed.documentType;
    if (parsed.category !== undefined) qdrantUpdates.category = parsed.category;
    if (tagList !== undefined) qdrantUpdates.tags = tagList;

    if (Object.keys(qdrantUpdates).length > 0) {
      await updateDocumentVectorsPayload(id, qdrantUpdates).catch((err) => {
        console.error('Failed to sync metadata update to Qdrant:', err);
      });
    }

    res.json({ success: true, data: document });
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
