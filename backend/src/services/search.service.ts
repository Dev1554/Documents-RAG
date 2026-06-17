import { Types } from 'mongoose';
import { DocumentModel } from '../models/Document';
import { DocumentChunk } from '../models/DocumentChunk';
import { generateEmbedding } from './embedding.service';
import { searchVectors } from './qdrant.service';
import { DocumentFilters, SearchResult } from '../types';
import {
  applyDocumentMetadataFilters,
  escapeRegex,
  hasMetadataFilters,
} from '../utils/documentFilterQuery';

const SEARCH_STOP_WORDS = new Set([
  'all',
  'and',
  'are',
  'document',
  'documents',
  'does',
  'every',
  'find',
  'for',
  'from',
  'give',
  'list',
  'mentioning',
  'mentions',
  'more',
  'show',
  'than',
  'that',
  'the',
  'this',
  'what',
  'where',
  'which',
  'who',
  'with',
  'worth',
  'year',
]);

function getBaseQuery(userQuery: string): string {
  return userQuery
    .replace(/₹/g, ' ')
    .replace(/\b(?:rs\.?|inr)\b/gi, ' ')
    .replace(/\b(?:more than|greater than|above|over|less than|below|under|at least|minimum|maximum|worth)\b/gi, ' ')
    .replace(/\b\d+(?:,\d{2,3})*(?:\.\d+)?\s*(?:lakh|lac|crore|k|thousand|million)?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeQuery(query: string): string[] {
  const terms = expandQueryTerms(getBaseQuery(query))
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g) || [];

  return Array.from(new Set(terms.filter((term) => !SEARCH_STOP_WORDS.has(term))));
}

function expandQueryTerms(query: string): string {
  const normalized = query.toLowerCase();
  const expansions: string[] = [query];

  if (/\bnda\b|\bnon disclosure\b/.test(normalized)) {
    expansions.push('nda non disclosure agreement confidential confidentiality signed client party');
  }

  if (/\bcontract\b|\bagreement\b/.test(normalized)) {
    expansions.push('contract agreement client party effective date expiry expiration expires termination renewal value amount');
  }

  if (/\bexpir(?:e|es|ing|y|ation)\b|\brenewal\b|\bvalid till\b|\bvalid until\b/.test(normalized)) {
    expansions.push('expiry expiration expires expiring valid until valid till renewal end date termination');
  }

  if (/\bclient\b|\bcustomer\b|\bparty\b/.test(normalized)) {
    expansions.push('client customer party company name signed by between');
  }

  if (isCurrentYearQuery(query)) {
    expansions.push(String(new Date().getFullYear()));
  }

  return expansions.join(' ');
}

function isCurrentYearQuery(query: string): boolean {
  return /\b(this year|current year)\b/i.test(query);
}

function stringifyExtractedData(value: unknown): string {
  if (!value || typeof value !== 'object') return '';

  const serialized = JSON.stringify(value);
  return serialized === '{}' ? '' : serialized;
}

interface AmountIntent {
  operator: 'gt' | 'gte' | 'lt' | 'lte';
  amount: number;
}

function parseAmountValue(rawAmount: string, rawUnit = ''): number {
  const base = Number(rawAmount.replace(/,/g, ''));
  const unit = rawUnit.toLowerCase();

  if (unit === 'lakh' || unit === 'lac') return base * 100000;
  if (unit === 'crore') return base * 10000000;
  if (unit === 'k' || unit === 'thousand') return base * 1000;
  if (unit === 'million') return base * 1000000;

  return base;
}

function parseAmountIntent(query: string): AmountIntent | null {
  const amountMatch = query.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:,\d{2,3})*(?:\.\d+)?)\s*(lakh|lac|crore|k|thousand|million)?/i);
  if (!amountMatch) return null;

  const amount = parseAmountValue(amountMatch[1], amountMatch[2]);
  const normalized = query.toLowerCase();

  if (/\b(more than|greater than|above|over)\b/.test(normalized)) {
    return { operator: 'gt', amount };
  }
  if (/\b(at least|minimum|min)\b/.test(normalized)) {
    return { operator: 'gte', amount };
  }
  if (/\b(less than|below|under)\b/.test(normalized)) {
    return { operator: 'lt', amount };
  }
  if (/\b(at most|maximum|max)\b/.test(normalized)) {
    return { operator: 'lte', amount };
  }

  return null;
}

function extractAmounts(text: string): number[] {
  const amounts: number[] = [];
  const amountRegex = /(?:₹|rs\.?|inr)?\s*(\d+(?:,\d{2,3})*(?:\.\d+)?)\s*(lakh|lac|crore|k|thousand|million)?/gi;

  let match;
  while ((match = amountRegex.exec(text)) !== null) {
    const value = parseAmountValue(match[1], match[2]);
    if (Number.isFinite(value)) amounts.push(value);
  }

  return amounts;
}

function matchesAmountIntent(text: string, intent: AmountIntent): boolean {
  return extractAmounts(text).some((amount) => {
    switch (intent.operator) {
      case 'gt':
        return amount > intent.amount;
      case 'gte':
        return amount >= intent.amount;
      case 'lt':
        return amount < intent.amount;
      case 'lte':
        return amount <= intent.amount;
    }
  });
}

function buildBaseDocumentQuery(userId: string, filters: DocumentFilters) {
  const query: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
    status: 'ready',
  };

  applyDocumentMetadataFilters(query, filters);

  return query;
}

export async function keywordSearch(
  userId: string,
  filters: DocumentFilters
): Promise<SearchResult[]> {
  const query = buildBaseDocumentQuery(userId, filters);

  if (filters.keyword) {
    const textDocuments = await DocumentModel.find({
      ...query,
      $text: { $search: filters.keyword },
    })
      .select('_id title originalName category tags aiSummary')
      .lean();

    const summaryDocuments = await DocumentModel.find({
      ...query,
      aiSummary: { $regex: escapeRegex(filters.keyword), $options: 'i' },
    })
      .select('_id title originalName category tags aiSummary')
      .limit(20)
      .lean();

    const documents = [...textDocuments, ...summaryDocuments].filter(
      (doc, index, allDocs) =>
        allDocs.findIndex((candidate) => candidate._id.toString() === doc._id.toString()) === index
    );

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

    const results = chunks.map((chunk) => {
      const doc = docMap.get(chunk.documentId.toString())!;
      return {
        chunkId: chunk._id.toString(),
        documentId: chunk.documentId.toString(),
        documentName: doc.title || doc.originalName,
        category: doc.category,
        tags: doc.tags,
        content: chunk.content,
        score: 1,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber || 1,
      };
    });

    const chunkDocIds = new Set(chunks.map((chunk) => chunk.documentId.toString()));
    for (const doc of documents) {
      if (chunkDocIds.has(doc._id.toString())) continue;

      results.push({
        chunkId: doc._id.toString(),
        documentId: doc._id.toString(),
        documentName: doc.title || doc.originalName,
        category: doc.category,
        tags: doc.tags,
        content: doc.aiSummary || doc.title || doc.originalName,
        score: 1,
        chunkIndex: 0,
        pageNumber: 1,
      });
    }

    return results;
  }

  const documents = await DocumentModel.find(query)
    .sort({ uploadedAt: -1 })
    .limit(20)
    .select('-extractedText')
    .lean();

  return documents.map((doc) => ({
    chunkId: doc._id.toString(),
    documentId: doc._id.toString(),
    documentName: doc.title || doc.originalName,
    category: doc.category,
    tags: doc.tags,
    content: doc.title || doc.originalName,
    score: 1,
    chunkIndex: 0,
    pageNumber: 1,
  }));
}

export async function semanticSearch(
  userId: string,
  query: string,
  filters: DocumentFilters,
  limit: number = 10
): Promise<SearchResult[]> {
  const embedding = await generateEmbedding(query);

  let dateFrom = filters.dateFrom?.toISOString();
  let dateTo = filters.dateTo?.toISOString();

  if (filters.year) {
    dateFrom = new Date(`${filters.year}-01-01T00:00:00.000Z`).toISOString();
    dateTo = new Date(`${filters.year}-12-31T23:59:59.999Z`).toISOString();
  }

  const vectorLimit = hasMetadataFilters(filters) ? Math.max(limit * 5, 30) : limit;

  const results = await searchVectors(
    embedding,
    {
      userId,
      dateFrom,
      dateTo,
    },
    vectorLimit
  );

  const chunkIds = results.map((r) => r.payload.chunkId);
  const chunks = await DocumentChunk.find({ qdrantPointId: { $in: chunkIds } }).lean();
  const chunkMap = new Map(chunks.map((c) => [c.qdrantPointId, c]));

  const mapped = results
    .map((result): SearchResult | null => {
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
        pageNumber: chunk.pageNumber || result.payload.pageNumber || 1,
      };
    })
    .filter((r): r is SearchResult => r !== null);

  if (!hasMetadataFilters(filters)) {
    return mapped.slice(0, limit);
  }

  const docIds = Array.from(new Set(mapped.map((result) => result.documentId)));
  const metadataQuery = buildBaseDocumentQuery(userId, filters);
  metadataQuery._id = { $in: docIds.map((id) => new Types.ObjectId(id)) };

  const matchingDocs = await DocumentModel.find(metadataQuery).select('_id').lean();
  const matchingIds = new Set(matchingDocs.map((doc) => doc._id.toString()));

  return mapped.filter((result) => matchingIds.has(result.documentId)).slice(0, limit);
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

async function documentMetadataSearch(
  userId: string,
  userQuery: string,
  filters: DocumentFilters,
  limit: number = 30
): Promise<SearchResult[]> {
  const terms = tokenizeQuery(userQuery);
  const baseQuery = buildBaseDocumentQuery(userId, filters);

  if (terms.length === 0) {
    const documents = await DocumentModel.find(baseQuery)
      .sort({ uploadedAt: -1 })
      .limit(limit)
      .select('_id title originalName category tags documentType aiSummary extractedData')
      .lean();

    return documents.map((doc) => ({
      chunkId: doc._id.toString(),
      documentId: doc._id.toString(),
      documentName: doc.title || doc.originalName,
      category: doc.category,
      tags: doc.tags,
      content: doc.aiSummary || stringifyExtractedData(doc.extractedData) || doc.title || doc.originalName,
      score: 0.8,
      chunkIndex: 0,
      pageNumber: 1,
    }));
  }

  const regexes = terms.map((term) => new RegExp(escapeRegex(term), 'i'));
  const documents = await DocumentModel.find({
    ...baseQuery,
    $or: regexes.flatMap((regex) => [
      { title: regex },
      { originalName: regex },
      { documentType: regex },
      { category: regex },
      { tags: regex },
      { aiSummary: regex },
    ]),
  })
    .limit(limit * 2)
    .select('_id title originalName category tags documentType aiSummary extractedData')
    .lean();

  return documents
    .map((doc) => {
      const haystack = [
        doc.title,
        doc.originalName,
        doc.documentType,
        doc.category,
        doc.tags.join(' '),
        doc.aiSummary,
        stringifyExtractedData(doc.extractedData),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);

      return {
        chunkId: doc._id.toString(),
        documentId: doc._id.toString(),
        documentName: doc.title || doc.originalName,
        category: doc.category,
        tags: doc.tags,
        content: doc.aiSummary || stringifyExtractedData(doc.extractedData) || doc.title || doc.originalName,
        score: score || 0.5,
        chunkIndex: 0,
        pageNumber: 1,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function filterByAmountIntent(
  results: SearchResult[],
  intent: AmountIntent | null
): Promise<SearchResult[]> {
  if (!intent || results.length === 0) return results;

  const docIds = Array.from(new Set(results.map((result) => result.documentId)));
  const [documents, chunks] = await Promise.all([
    DocumentModel.find({ _id: { $in: docIds } })
      .select('_id title originalName aiSummary extractedData')
      .lean(),
    DocumentChunk.find({ documentId: { $in: docIds } })
      .select('documentId content pageNumber chunkIndex')
      .lean(),
  ]);

  const documentText = new Map<string, string>();
  for (const doc of documents) {
    documentText.set(
      doc._id.toString(),
      [doc.title, doc.originalName, doc.aiSummary, stringifyExtractedData(doc.extractedData)]
        .filter(Boolean)
        .join('\n')
    );
  }

  for (const chunk of chunks) {
    const docId = chunk.documentId.toString();
    documentText.set(docId, `${documentText.get(docId) || ''}\n${chunk.content}`);
  }

  return results.filter((result) =>
    matchesAmountIntent(`${result.content}\n${documentText.get(result.documentId) || ''}`, intent)
  );
}

async function enrichWithDocumentChunks(
  results: SearchResult[],
  userQuery: string,
  limit: number
): Promise<SearchResult[]> {
  if (results.length === 0) return results;

  const docIds = Array.from(new Set(results.map((result) => result.documentId))).slice(0, limit);
  const terms = tokenizeQuery(userQuery);
  const regexes = terms.map((term) => new RegExp(escapeRegex(term), 'i'));

  const documents = await DocumentModel.find({ _id: { $in: docIds } })
    .select('_id title originalName category tags')
    .lean();
  const docMap = new Map(documents.map((doc) => [doc._id.toString(), doc]));

  const chunkQuery =
    regexes.length > 0
      ? {
          documentId: { $in: docIds },
          $or: regexes.map((regex) => ({ content: regex })),
        }
      : { documentId: { $in: docIds } };

  const matchedChunks = await DocumentChunk.find(chunkQuery)
    .sort({ chunkIndex: 1 })
    .limit(limit * 3)
    .lean();

  const docsWithMatchedChunks = new Set(matchedChunks.map((chunk) => chunk.documentId.toString()));
  const fallbackChunks = await DocumentChunk.find({
    documentId: {
      $in: docIds.filter((docId) => !docsWithMatchedChunks.has(docId)),
    },
  })
    .sort({ chunkIndex: 1 })
    .limit(limit)
    .lean();

  const seen = new Set(results.map((result) => `${result.documentId}-${result.chunkIndex}-${result.pageNumber || 1}`));
  const enriched = [...results];

  for (const chunk of [...matchedChunks, ...fallbackChunks]) {
    const document = docMap.get(chunk.documentId.toString());
    if (!document) continue;

    const key = `${chunk.documentId.toString()}-${chunk.chunkIndex}-${chunk.pageNumber || 1}`;
    if (seen.has(key)) continue;

    seen.add(key);
    enriched.push({
      chunkId: chunk._id.toString(),
      documentId: chunk.documentId.toString(),
      documentName: document.title || document.originalName,
      category: document.category,
      tags: document.tags,
      content: chunk.content,
      score: 1.2,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber || 1,
    });
  }

  return enriched;
}

export async function globalAISearch(
  userId: string,
  query: string,
  filters: DocumentFilters = {},
  limit: number = 20
): Promise<SearchResult[]> {
  const amountIntent = parseAmountIntent(query);
  const baseQuery = getBaseQuery(query) || query;

  const [semantic, keyword, metadata] = await Promise.all([
    semanticSearch(userId, baseQuery, filters, Math.max(limit, 20)),
    keywordSearch(userId, { ...filters, keyword: baseQuery }),
    documentMetadataSearch(userId, query, filters, Math.max(limit, 30)),
  ]);

  const seen = new Set<string>();
  const combined: SearchResult[] = [];

  for (const result of [...metadata, ...keyword, ...semantic]) {
    const key = `${result.documentId}-${result.chunkIndex}-${result.pageNumber || 1}`;
    if (seen.has(key)) continue;

    seen.add(key);
    combined.push(result);
  }

  const amountFiltered = await filterByAmountIntent(combined, amountIntent);
  const enriched = await enrichWithDocumentChunks(amountIntent ? amountFiltered : combined, query, limit);

  return enriched
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export type ChatSearchMode = 'specific' | 'process';

export function classifyChatSearchMode(query: string): ChatSearchMode {
  const normalized = query.toLowerCase();
  const processSignals = [
    /\bprocess\b/,
    /\bprocedure\b/,
    /\bhow do i\b/,
    /\bhow to\b/,
    /\bsteps?\b/,
    /\bworkflow\b/,
    /\bguide\b/,
    /\bchecklist\b/,
    /\brequirements?\b/,
    /\bapply(?:ing)?\b/,
    /\bapplication\b/,
    /\bexplain\b/,
    /\boverview\b/,
    /\bwhat is the\b/,
    /\bhelp me with\b/,
  ];

  if (processSignals.some((pattern) => pattern.test(normalized))) {
    return 'process';
  }

  return 'specific';
}

function dedupeChatResultsByDocument(results: SearchResult[]): SearchResult[] {
  const bestByDocument = new Map<string, SearchResult>();

  for (const result of results) {
    const existing = bestByDocument.get(result.documentId);
    if (!existing || result.score > existing.score) {
      bestByDocument.set(result.documentId, result);
    }
  }

  return Array.from(bestByDocument.values()).sort((a, b) => b.score - a.score);
}

export function filterChatSearchResults(
  results: SearchResult[],
  query: string,
  mode: ChatSearchMode
): SearchResult[] {
  const deduped = dedupeChatResultsByDocument(results);

  if (mode === 'process') {
    return deduped.slice(0, 20);
  }

  const terms = tokenizeQuery(query);
  if (terms.length === 0) {
    return deduped.slice(0, 5);
  }

  const strictMatches = deduped.filter((result) => {
    const haystack = [
      result.documentName,
      result.category,
      ...(result.tags || []),
      result.content,
    ]
      .join(' ')
      .toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });

  return strictMatches.slice(0, 8);
}
