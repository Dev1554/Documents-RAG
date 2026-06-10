import { Types } from 'mongoose';
import { DocumentModel } from '../models/Document';
import { DocumentChunk } from '../models/DocumentChunk';
import { chunkText } from './chunking.service';
import { generateEmbeddings } from './embedding.service';
import { deleteDocumentVectors, generatePointId, upsertVectors } from './qdrant.service';
import { extractText, isImageMimeType } from './textExtraction.service';
import { storageService } from './storage.service';
import { AppError } from '../utils/AppError';
import { DocumentFilters } from '../types';

export async function processDocument(documentId: string): Promise<void> {
  const document = await DocumentModel.findById(documentId);
  if (!document) return;

  try {
    document.status = 'processing';
    await document.save();

    if (isImageMimeType(document.mimeType)) {
      document.status = 'pending_ocr';
      document.extractedText = '';
      document.chunkCount = 0;
      await document.save();
      return;
    }

    const textResult = await extractText(document.filePath, document.mimeType);
    document.extractedText = textResult.text;

    if (!textResult.text) {
      document.status = 'ready';
      document.chunkCount = 0;
      await document.save();
      return;
    }

    const chunks: Array<{
      index: number;
      content: string;
      tokenCount: number;
      pageNumber: number;
    }> = [];

    let chunkIndex = 0;
    for (const page of textResult.pages) {
      const pageChunks = chunkText(page.text);
      for (const c of pageChunks) {
        chunks.push({
          index: chunkIndex,
          content: c.content,
          tokenCount: c.tokenCount,
          pageNumber: page.pageNumber,
        });
        chunkIndex++;
      }
    }

    document.chunkCount = chunks.length;

    if (chunks.length === 0) {
      document.status = 'ready';
      await document.save();
      return;
    }

    await DocumentChunk.deleteMany({ documentId: document._id });
    await deleteDocumentVectors(document._id.toString());

    const embeddings = await generateEmbeddings(chunks.map((c) => c.content));
    const uploadedAt = document.uploadedAt.toISOString();

    const chunkDocs = chunks.map((chunk, i) => {
      const pointId = generatePointId();
      return {
        documentId: document._id,
        userId: document.userId,
        chunkIndex: chunk.index,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        qdrantPointId: pointId,
        pageNumber: chunk.pageNumber,
        embedding: embeddings[i],
      };
    });

    await DocumentChunk.insertMany(
      chunkDocs.map(({ embedding: _e, ...doc }) => doc)
    );

    await upsertVectors(
      chunkDocs.map((doc) => ({
        id: doc.qdrantPointId,
        vector: doc.embedding,
        payload: {
          chunkId: doc.qdrantPointId,
          documentId: document._id.toString(),
          userId: document.userId.toString(),
          documentName: document.title,
          documentType: document.documentType,
          uploadedBy: document.uploadedBy,
          category: document.category,
          tags: document.tags,
          chunkIndex: doc.chunkIndex,
          uploadedAt,
          pageNumber: doc.pageNumber,
        },
      }))
    );

    document.status = 'ready';
    await document.save();
  } catch (error) {
    document.status = 'failed';
    document.errorMessage = error instanceof Error ? error.message : 'Processing failed';
    await document.save();
  }
}

export async function listDocuments(userId: string, filters: DocumentFilters) {
  const query: Record<string, unknown> = { userId: new Types.ObjectId(userId) };

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.tags && filters.tags.length > 0) {
    query.tags = { $in: filters.tags };
  }

  if (filters.uploadedBy) {
    query.uploadedBy = filters.uploadedBy;
  }

  if (filters.year) {
    const start = new Date(`${filters.year}-01-01T00:00:00.000Z`);
    const end = new Date(`${filters.year}-12-31T23:59:59.999Z`);
    query.uploadedAt = { $gte: start, $lte: end };
  } else if (filters.dateFrom || filters.dateTo) {
    query.uploadedAt = {};
    if (filters.dateFrom) {
      (query.uploadedAt as Record<string, Date>).$gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      (query.uploadedAt as Record<string, Date>).$lte = filters.dateTo;
    }
  }

  if (filters.keyword) {
    query.$text = { $search: filters.keyword };
  }

  return DocumentModel.find(query)
    .sort({ uploadedAt: -1 })
    .select('-extractedText')
    .lean();
}

export async function getDocumentById(userId: string, documentId: string) {
  const document = await DocumentModel.findOne({
    _id: documentId,
    userId,
  }).lean();

  if (!document) {
    throw new AppError('Document not found', 404);
  }

  return document;
}

export async function getRelatedDocuments(
  userId: string,
  documentId: string,
  category: string,
  tags: string[]
) {
  return DocumentModel.find({
    userId,
    _id: { $ne: documentId },
    $or: [{ category }, { tags: { $in: tags } }],
    status: 'ready',
  })
    .sort({ uploadedAt: -1 })
    .limit(5)
    .select('-extractedText')
    .lean();
}

export async function deleteDocument(userId: string, documentId: string) {
  const document = await DocumentModel.findOne({ _id: documentId, userId });
  if (!document) {
    throw new AppError('Document not found', 404);
  }

  await storageService.deleteFile(document.filePath);
  await DocumentChunk.deleteMany({ documentId: document._id });
  await deleteDocumentVectors(document._id.toString());
  await document.deleteOne();

  return { message: 'Document deleted' };
}

export async function getDashboardStats(userId: string) {
  const [totalDocuments, readyDocuments, pendingDocuments, categories] = await Promise.all([
    DocumentModel.countDocuments({ userId }),
    DocumentModel.countDocuments({ userId, status: 'ready' }),
    DocumentModel.countDocuments({ userId, status: { $in: ['pending', 'processing', 'pending_ocr'] } }),
    DocumentModel.distinct('category', { userId }),
  ]);

  const recentDocuments = await DocumentModel.find({ userId })
    .sort({ uploadedAt: -1 })
    .limit(5)
    .select('-extractedText')
    .lean();

  return {
    totalDocuments,
    readyDocuments,
    pendingDocuments,
    categoryCount: categories.length,
    recentDocuments,
  };
}
