import { Types } from 'mongoose';
import { DocumentModel } from '../models/Document';
import { DocumentChunk } from '../models/DocumentChunk';
import { generateEmbedding } from './embedding.service';
import { searchVectors } from './qdrant.service';
import { DocumentFilters, SearchResult } from '../types';

export async function keywordSearch(
  userId: string,
  filters: DocumentFilters
): Promise<SearchResult[]> {
  const query: Record<string, unknown> = { userId: new Types.ObjectId(userId) };

  if (filters.category) query.category = filters.category;
  if (filters.tags?.length) query.tags = { $in: filters.tags };
  if (filters.dateFrom || filters.dateTo) {
    query.uploadedAt = {};
    if (filters.dateFrom) (query.uploadedAt as Record<string, Date>).$gte = filters.dateFrom;
    if (filters.dateTo) (query.uploadedAt as Record<string, Date>).$lte = filters.dateTo;
  }

  if (filters.keyword) {
    const documents = await DocumentModel.find({
      ...query,
      $text: { $search: filters.keyword },
    })
      .select('_id originalName category tags')
      .lean();

    if (documents.length === 0) return [];

    const docIds = documents.map((d) => d._id);
    const docMap = new Map(documents.map((d) => [d._id.toString(), d]));

    const chunks = await DocumentChunk.find({
      userId,
      documentId: { $in: docIds },
      $text: { $search: filters.keyword },
    })
      .limit(20)
      .lean();

    return chunks.map((chunk) => {
      const doc = docMap.get(chunk.documentId.toString())!;
      return {
        chunkId: chunk._id.toString(),
        documentId: chunk.documentId.toString(),
        documentName: doc.originalName,
        category: doc.category,
        tags: doc.tags,
        content: chunk.content,
        score: 1,
        chunkIndex: chunk.chunkIndex,
      };
    });
  }

  const documents = await DocumentModel.find(query)
    .sort({ uploadedAt: -1 })
    .limit(20)
    .select('-extractedText')
    .lean();

  return documents.map((doc) => ({
    chunkId: doc._id.toString(),
    documentId: doc._id.toString(),
    documentName: doc.originalName,
    category: doc.category,
    tags: doc.tags,
    content: doc.originalName,
    score: 1,
    chunkIndex: 0,
  }));
}

export async function semanticSearch(
  userId: string,
  query: string,
  filters: DocumentFilters,
  limit: number = 10
): Promise<SearchResult[]> {
  const embedding = await generateEmbedding(query);

  const results = await searchVectors(
    embedding,
    {
      userId,
      category: filters.category,
      tags: filters.tags,
      dateFrom: filters.dateFrom?.toISOString(),
      dateTo: filters.dateTo?.toISOString(),
    },
    limit
  );

  const chunkIds = results.map((r) => r.payload.chunkId);
  const chunks = await DocumentChunk.find({ qdrantPointId: { $in: chunkIds } }).lean();
  const chunkMap = new Map(chunks.map((c) => [c.qdrantPointId, c]));

  return results
    .map((result) => {
      const chunk = chunkMap.get(result.payload.chunkId);
      if (!chunk) return null;

      return {
        chunkId: chunk._id.toString(),
        documentId: result.payload.documentId,
        documentName: result.payload.documentName,
        category: result.payload.category,
        tags: result.payload.tags,
        content: chunk.content,
        score: result.score,
        chunkIndex: result.payload.chunkIndex,
      };
    })
    .filter((r): r is SearchResult => r !== null);
}

export async function hybridSearch(
  userId: string,
  query: string,
  filters: DocumentFilters,
  limit: number = 10
): Promise<SearchResult[]> {
  const [semantic, keyword] = await Promise.all([
    semanticSearch(userId, query, filters, limit),
    keywordSearch(userId, { ...filters, keyword: query }),
  ]);

  const seen = new Set<string>();
  const combined: SearchResult[] = [];

  for (const result of [...semantic, ...keyword]) {
    const key = `${result.documentId}-${result.chunkIndex}`;
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(result);
    }
  }

  return combined.slice(0, limit);
}
