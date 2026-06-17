import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Types } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { AuthRequest, DocumentFilters } from '../types';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { storageService } from '../services/storage.service';
import { isSupportedMimeType } from '../services/textExtraction.service';
import { DocumentModel } from '../models/Document';
import { updateDocumentVectorsPayload } from '../services/qdrant.service';
import { getDocumentAuditLogs, recordDocumentAudit } from '../services/audit.service';
import {
  getFolderBreadcrumbs,
  getFolderOrThrow,
  migrateUserFoldersFromCategories,
  resolveUploadFolderId,
} from '../services/folder.service';
import {
  processDocument,
  listDocuments,
  getDocumentById,
  getDocumentVersions,
  getRelatedDocuments,
  summarizeDocument,
  deleteDocument,
  getDashboardStats,
} from '../services/documentProcessing.service';

const router = Router();
router.use(authenticate);
const archiver: any = require('archiver');

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
  if (typeof query.folderId === 'string' && query.folderId.trim()) {
    filters.folderId = query.folderId.trim();
  }
  if (query.includeNested === 'true' || query.includeNested === '1') {
    filters.includeNested = true;
  }

  return filters;
}

function normalizeVersionBase(value: string): string {
  const base = value.substring(0, value.lastIndexOf('.')) || value;
  return base
    .replace(/\b(?:v|version)[\s_-]*\d+\b/gi, '')
    .replace(/\s*\(\d+\)\s*$/g, '')
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function sanitizeArchiveFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim() || 'document';
}

function uniqueArchiveFileName(name: string, usedNames: Set<string>): string {
  const sanitized = sanitizeArchiveFileName(name);
  if (!usedNames.has(sanitized)) {
    usedNames.add(sanitized);
    return sanitized;
  }

  const dotIndex = sanitized.lastIndexOf('.');
  const base = dotIndex > 0 ? sanitized.slice(0, dotIndex) : sanitized;
  const ext = dotIndex > 0 ? sanitized.slice(dotIndex) : '';
  let counter = 2;
  let candidate = `${base} (${counter})${ext}`;

  while (usedNames.has(candidate)) {
    counter += 1;
    candidate = `${base} (${counter})${ext}`;
  }

  usedNames.add(candidate);
  return candidate;
}

function extractExplicitVersion(value: string): number | null {
  const base = value.substring(0, value.lastIndexOf('.')) || value;
  const match = base.match(/\b(?:v|version)[\s_-]*(\d+)\b/i);
  if (!match) return null;

  const version = Number(match[1]);
  return Number.isFinite(version) && version > 0 ? version : null;
}

async function resolveVersionMetadata(
  userId: string,
  title: string,
  originalName: string,
  category: string,
  documentType: string
) {
  const baseKey = normalizeVersionBase(title) || normalizeVersionBase(originalName);
  const versionGroupKey = [category, documentType, baseKey].join('|').toLowerCase();
  const explicitVersion = extractExplicitVersion(title) || extractExplicitVersion(originalName);

  const latestVersion = await DocumentModel.findOne({ userId, versionGroupKey })
    .sort({ versionNumber: -1 })
    .select('versionNumber')
    .lean();

  const versionNumber = explicitVersion || ((latestVersion?.versionNumber || 0) + 1);
  const isLatestVersion = versionNumber >= (latestVersion?.versionNumber || 0);

  if (isLatestVersion) {
    await DocumentModel.updateMany(
      { userId, versionGroupKey, isLatestVersion: true },
      { $set: { isLatestVersion: false } }
    );
  }

  return {
    versionGroupKey,
    versionNumber,
    versionLabel: `v${versionNumber}`,
    isLatestVersion,
  };
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
      folderId: z.string().optional(),
      tags: z.string().optional(),
      title: z.string().optional(),
      documentType: z.string().optional(),
    });

    const { category, folderId, tags, title, documentType } = schema.parse(req.body);
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
    const versionMetadata = await resolveVersionMetadata(
      req.user!.id,
      finalTitle,
      req.file.originalname,
      category,
      finalDocType
    );

    const stored = await storageService.saveFile(req.file, req.user!.id);
    const resolvedFolderId = await resolveUploadFolderId(req.user!.id, folderId, category);

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
      folderId: resolvedFolderId,
      tags: tagList,
      ...versionMetadata,
      status: 'pending',
    });

    await recordDocumentAudit('uploaded', req.user!, document, req);

    processDocument(document._id.toString()).catch(console.error);

    res.status(201).json({ success: true, data: document });
  })
);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    await migrateUserFoldersFromCategories(req.user!.id);
    const filters = parseFilters(req.query as Record<string, unknown>);
    const documents = await listDocuments(req.user!.id, filters);
    res.json({ success: true, data: documents });
  })
);

router.get(
  '/download-bulk',
  asyncHandler(async (req: AuthRequest, res) => {
    const idsParam = typeof req.query.ids === 'string' ? req.query.ids : '';
    const documentIds = Array.from(
      new Set(
        idsParam
          .split(',')
          .map((id) => id.trim())
          .filter((id) => Types.ObjectId.isValid(id))
      )
    ).slice(0, 50);

    if (documentIds.length === 0) {
      throw new AppError('At least one valid document id is required', 400);
    }

    const documents = await DocumentModel.find({
      _id: { $in: documentIds },
      userId: req.user!.id,
    }).sort({ uploadedAt: -1 });

    if (documents.length === 0) {
      throw new AppError('No downloadable documents found', 404);
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    const usedNames = new Set<string>();

    archive.on('error', (error: Error) => {
      res.destroy(error);
    });

    res.attachment(`documents-${new Date().toISOString().slice(0, 10)}.zip`);
    archive.pipe(res);

    for (const document of documents) {
      const archiveName = uniqueArchiveFileName(document.originalName, usedNames);
      archive.file(storageService.getAbsolutePath(document.filePath), { name: archiveName });
      await recordDocumentAudit('downloaded', req.user!, document, req);
    }

    await archive.finalize();
  })
);

router.get(
  '/:id/preview',
  asyncHandler(async (req: AuthRequest, res) => {
    const document = await DocumentModel.findOne({ _id: String(req.params.id), userId: req.user!.id });
    if (!document) {
      throw new AppError('Document not found', 404);
    }

    res.sendFile(storageService.getAbsolutePath(document.filePath), {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': `inline; filename="${document.originalName.replace(/"/g, '')}"`,
      },
    });
  })
);

router.get(
  '/:id/download',
  asyncHandler(async (req: AuthRequest, res) => {
    const document = await DocumentModel.findOne({ _id: String(req.params.id), userId: req.user!.id });
    if (!document) {
      throw new AppError('Document not found', 404);
    }

    await recordDocumentAudit('downloaded', req.user!, document, req);
    res.download(storageService.getAbsolutePath(document.filePath), document.originalName);
  })
);

router.get(
  '/:id/summary',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await summarizeDocument(req.user!.id, String(req.params.id));
    res.json({ success: true, data: result });
  })
);

router.get(
  '/:id/versions',
  asyncHandler(async (req: AuthRequest, res) => {
    const document = await getDocumentById(req.user!.id, String(req.params.id));
    const versions = await getDocumentVersions(req.user!.id, document);
    res.json({ success: true, data: versions });
  })
);

router.get(
  '/:id/audit-logs',
  asyncHandler(async (req: AuthRequest, res) => {
    const document = await getDocumentById(req.user!.id, String(req.params.id));
    const logs = await getDocumentAuditLogs(document._id.toString(), req.user!.id);
    res.json({ success: true, data: logs });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = String(req.params.id);
    const document = await getDocumentById(req.user!.id, id);
    await recordDocumentAudit('viewed', req.user!, document, req);
    const related = await getRelatedDocuments(
      req.user!.id,
      document
    );
    const versions = await getDocumentVersions(req.user!.id, document);
    const folderBreadcrumb = document.folderId
      ? await getFolderBreadcrumbs(req.user!.id, document.folderId.toString())
      : [];
    const folder = document.folderId
      ? await getFolderOrThrow(req.user!.id, document.folderId.toString())
      : null;
    res.json({ success: true, data: { document, related, versions, folder, folderBreadcrumb } });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = String(req.params.id);
    const schema = z.object({
      title: z.string().min(1).optional(),
      category: z.string().min(1).optional(),
      folderId: z.string().optional().nullable(),
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
    if (parsed.folderId !== undefined) {
      if (parsed.folderId === null) {
        document.folderId = undefined;
      } else {
        await getFolderOrThrow(req.user!.id, parsed.folderId);
        document.folderId = new Types.ObjectId(parsed.folderId);
      }
    }
    
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
    const document = await getDocumentById(req.user!.id, String(req.params.id));
    await recordDocumentAudit('deleted', req.user!, document, req);
    const result = await deleteDocument(req.user!.id, String(req.params.id));
    res.json({ success: true, data: result });
  })
);

export default router;
