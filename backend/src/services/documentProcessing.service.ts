import { Types } from 'mongoose';
import { DocumentModel } from '../models/Document';
import { DocumentChunk } from '../models/DocumentChunk';
import { chunkText } from './chunking.service';
import { generateChatCompletion, generateEmbeddings } from './embedding.service';
import { deleteDocumentVectors, generatePointId, upsertVectors } from './qdrant.service';
import {
  extractGstinCandidate,
  reconcileExtractedData,
  reconcileFieldValue,
} from './extractionReconcile.service';
import { extractText } from './textExtraction.service';
import { storageService } from './storage.service';
import { AppError } from '../utils/AppError';
import { DocumentFilters } from '../types';
import { getFolderDocumentFilter } from './folder.service';
import { applyDocumentMetadataFilters } from '../utils/documentFilterQuery';

const DOCUMENT_SUMMARY_SYSTEM_PROMPT = `You summarize business documents for a document preview screen.
Use only the provided extracted document text.
Keep the summary concise, practical, and useful for search.
Return plain text in this shape:

Summary:
[One or two sentences describing what this document is.]

Key Details:
- [Important identifiers such as GSTIN, PAN, Aadhaar number, invoice number, agreement number, or account number if present]
- [Important dates such as issue date, registration date, expiry date, invoice date, or contract date if present]
- [Important parties, amounts, obligations, or addresses if present]

Verification Notes:
- [Anything the user should verify manually if OCR/text appears incomplete or uncertain]

Rules:
- Copy all numbers and identifiers exactly as they appear in the extracted text.
- Never truncate, mask, abbreviate, or replace digits with X.
- If the text shows 123456789, the summary must show 123456789 in full, not 12345.

If the provided text is insufficient, say that clearly.`;

const DOCUMENT_TAGS_SYSTEM_PROMPT = `You classify business documents for search filters.
Use only the provided document metadata and extracted text.
Return ONLY a JSON array of 3 to 8 short tags.

Rules:
- Tags must be concise, human-readable labels.
- Prefer business tags such as GST, Tax, Certificate, Government, Aadhaar, PAN, Contract, Bank Statement, Invoice, Compliance, Registration.
- Include document type, authority/domain, and business purpose when clear.
- Do not include long phrases, explanations, markdown, or duplicate tags.

Example response:
["GST","Tax","Certificate","Government"]`;

const DOCUMENT_EXTRACTION_SYSTEM_PROMPT = `You extract structured accounting and compliance data from business documents.
Use only the provided metadata and extracted text.
Return ONLY valid JSON. Do not include markdown, comments, or explanation.

Return this shape:
{
  "documentKind": "gst_certificate | invoice | bank_statement | contract | nda | pan | aadhaar | other",
  "confidence": 0.0,
  "fields": {},
  "transactions": [],
  "notes": []
}

Rules:
- Put document-level key-value pairs under "fields".
- Use camelCase keys.
- Use null when a field is expected for the detected document kind but not found.
- Keep dates as strings exactly as shown, or ISO-like strings only when obvious.
- Keep amounts as strings with currency if present.
- CRITICAL: Copy all numbers and identifiers exactly as they appear in the extracted text. Never truncate, mask, abbreviate, or replace digits with X. If the text shows 123456789, return 123456789 in full.
- For numeric IDs (GSTIN, PAN, Aadhaar, account numbers, invoice numbers, phone numbers), preserve every digit and letter from the source text.
- For GST certificates, extract gstNumber, legalName, tradeName, constitutionOfBusiness, registrationDate, issueDate, address, state, centerJurisdiction, stateJurisdiction.
- For invoices, extract invoiceNumber, invoiceDate, dueDate, amount, taxableValue, gst, cgst, sgst, igst, client, vendor, placeOfSupply.
- For bank statements, extract accountNumber, accountHolder, bankName, branch, ifsc, period, openingBalance, closingBalance, and put transaction rows in transactions.
- For contracts/NDAs, extract parties, client, effectiveDate, expiryDate, contractValue, renewalTerms, terminationClause, governingLaw, signedDate.
- notes should include OCR uncertainty or missing critical fields.

Example:
{
  "documentKind": "gst_certificate",
  "confidence": 0.86,
  "fields": {
    "gstNumber": "24ABCDE1234F1Z5",
    "legalName": "Example Pvt Ltd",
    "registrationDate": "01/05/2025"
  },
  "transactions": [],
  "notes": []
}`;

function buildDocumentSummaryPrompt(document: {
  title: string;
  documentType: string;
  category: string;
  originalName: string;
}, extractedText: string) {
  return `Document title: ${document.title}
Document type: ${document.documentType}
Category: ${document.category}
Original filename: ${document.originalName}

Extracted text:
${extractedText.slice(0, 12000)}`;
}

function buildDocumentTagsPrompt(document: {
  title: string;
  documentType: string;
  category: string;
  originalName: string;
  tags: string[];
}, extractedText: string) {
  return `Document title: ${document.title}
Document type: ${document.documentType}
Category: ${document.category}
Original filename: ${document.originalName}
Existing user tags: ${document.tags.join(', ') || 'None'}

Extracted text:
${extractedText.slice(0, 8000)}`;
}

function buildDocumentExtractionPrompt(document: {
  title: string;
  documentType: string;
  category: string;
  originalName: string;
  tags: string[];
}, extractedText: string) {
  return `Document title: ${document.title}
Document type: ${document.documentType}
Category: ${document.category}
Original filename: ${document.originalName}
Tags: ${document.tags.join(', ') || 'None'}

Extracted text:
${extractedText.slice(0, 16000)}`;
}

function getExtractedStringField(
  extractedData: Record<string, unknown> | undefined,
  fieldKey: string
): string | null {
  const fields = extractedData?.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return null;

  const value = (fields as Record<string, unknown>)[fieldKey];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function reconcileSummaryWithExtractedFields(
  summary: string,
  extractedData?: Record<string, unknown>
): string {
  const gstNumber = getExtractedStringField(extractedData, 'gstNumber');
  if (!gstNumber) return summary;

  return summary.replace(
    /(GSTIN\s*[:\-]\s*)([A-Z0-9][A-Z0-9 ./-]{4,})/gi,
    (_match, prefix: string) => `${prefix}${gstNumber}`
  );
}

function reconcileSummaryIdentifiers(
  summary: string,
  extractedText: string,
  extractedData?: Record<string, unknown>
): string {
  const fieldReconciled = reconcileSummaryWithExtractedFields(summary, extractedData);

  return fieldReconciled.replace(/\b[A-Z0-9][A-Z0-9./-]{4,}\b/gi, (token) => {
    if (/^\d{1,4}[./-]\d{1,2}([./-]\d{1,4})?$/.test(token)) {
      return token;
    }

    const gstin = extractGstinCandidate(token);
    if (gstin) {
      return gstin;
    }

    const reconciled = reconcileFieldValue(token, extractedText);
    return reconciled.length > token.length ? reconciled : token;
  });
}

async function generateDocumentSummary(document: {
  title: string;
  documentType: string;
  category: string;
  originalName: string;
}, extractedText: string, extractedData?: Record<string, unknown>): Promise<string> {
  const summary = await generateChatCompletion(
    DOCUMENT_SUMMARY_SYSTEM_PROMPT,
    buildDocumentSummaryPrompt(document, extractedText)
  );
  return reconcileSummaryIdentifiers(summary, extractedText, extractedData);
}

function parseTagResponse(response: string): string[] {
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  const candidate = jsonMatch ? jsonMatch[0] : response;

  try {
    const parsed = JSON.parse(candidate);
    if (Array.isArray(parsed)) {
      return parsed.filter((tag): tag is string => typeof tag === 'string');
    }
  } catch {
    // Fall back to splitting plain text responses if the model returns non-JSON.
  }

  return response
    .split(/[\n,]/)
    .map((tag) => tag.replace(/^[-*"\s]+|["\s]+$/g, ''))
    .filter(Boolean);
}

function normalizeTag(tag: string): string {
  return tag
    .replace(/[#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

function mergeTags(existingTags: string[], generatedTags: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const tag of [...existingTags, ...generatedTags]) {
    const normalized = normalizeTag(tag);
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    merged.push(normalized);
  }

  return merged.slice(0, 12);
}

async function generateDocumentTags(document: {
  title: string;
  documentType: string;
  category: string;
  originalName: string;
  tags: string[];
}, extractedText: string): Promise<string[]> {
  const response = await generateChatCompletion(
    DOCUMENT_TAGS_SYSTEM_PROMPT,
    buildDocumentTagsPrompt(document, extractedText)
  );

  return parseTagResponse(response);
}

function parseJsonObjectResponse(response: string): Record<string, unknown> {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : response;

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Return a structured error payload rather than failing the whole ingestion.
  }

  return {
    documentKind: 'other',
    confidence: 0,
    fields: {},
    transactions: [],
    notes: ['AI extraction response could not be parsed as JSON.'],
  };
}

async function generateDocumentExtraction(document: {
  title: string;
  documentType: string;
  category: string;
  originalName: string;
  tags: string[];
}, extractedText: string): Promise<Record<string, unknown>> {
  const response = await generateChatCompletion(
    DOCUMENT_EXTRACTION_SYSTEM_PROMPT,
    buildDocumentExtractionPrompt(document, extractedText)
  );

  const parsed = parseJsonObjectResponse(response);
  return reconcileExtractedData(parsed, extractedText);
}

export async function processDocument(documentId: string): Promise<void> {
  const document = await DocumentModel.findById(documentId);
  if (!document) return;

  try {
    document.status = 'processing';
    await document.save();

    const textResult = await extractText(document.filePath, document.mimeType);
    document.extractedText = textResult.text;

    if (!textResult.text) {
      document.aiSummary = 'Summary:\nNo extractable text was found in this document.\n\nVerification Notes:\n- Re-upload a clearer scan or check OCR support for this file type before relying on search results.';
      document.tags = mergeTags(
        document.tags,
        await generateDocumentTags(document, 'No extractable text was found. Use the metadata only.')
      );
      document.extractedData = {
        documentKind: 'other',
        confidence: 0,
        fields: {},
        transactions: [],
        notes: ['No extractable text was found. Structured extraction could not be completed.'],
      };
      document.status = 'ready';
      document.chunkCount = 0;
      await document.save();
      return;
    }

    document.extractedData = await generateDocumentExtraction(document, textResult.text);
    document.aiSummary = await generateDocumentSummary(document, textResult.text, document.extractedData);
    document.tags = mergeTags(document.tags, await generateDocumentTags(document, textResult.text));

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

  const folderFilter = await getFolderDocumentFilter(
    userId,
    filters.folderId,
    filters.includeNested
  );
  if (folderFilter) {
    Object.assign(query, folderFilter);
  }

  applyDocumentMetadataFilters(query, filters);

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

  if (document.aiSummary) {
    document.aiSummary = reconcileSummaryIdentifiers(
      document.aiSummary,
      document.extractedText || '',
      document.extractedData as Record<string, unknown> | undefined
    );
  }

  return document;
}

export async function getDocumentVersions(
  userId: string,
  sourceDocument: { _id: Types.ObjectId | string; versionGroupKey?: string }
) {
  const query: Record<string, unknown> = {
    userId,
  };

  if (sourceDocument.versionGroupKey) {
    query.versionGroupKey = sourceDocument.versionGroupKey;
  } else {
    query._id = sourceDocument._id;
  }

  return DocumentModel.find(query)
    .sort({ versionNumber: -1, uploadedAt: -1 })
    .select('-extractedText')
    .lean();
}

export async function summarizeDocument(userId: string, documentId: string) {
  const document = await DocumentModel.findOne({ _id: documentId, userId });

  if (!document) {
    throw new AppError('Document not found', 404);
  }

  if (document.aiSummary) {
    const reconciledSummary = reconcileSummaryIdentifiers(
      document.aiSummary,
      document.extractedText || '',
      document.extractedData as Record<string, unknown> | undefined
    );

    if (reconciledSummary !== document.aiSummary) {
      document.aiSummary = reconciledSummary;
      await document.save();
    }

    return {
      summary: reconciledSummary,
      cached: true,
    };
  }

  if (document.status !== 'ready') {
    throw new AppError('Document is not ready for summarization yet', 409);
  }

  const extractedText = document.extractedText?.trim();
  if (!extractedText) {
    throw new AppError('Document text is not available for summarization yet', 400);
  }

  const summary = await generateDocumentSummary(
    document,
    extractedText,
    document.extractedData as Record<string, unknown> | undefined
  );

  document.aiSummary = summary;
  await document.save();

  return {
    summary,
    cached: false,
  };
}

interface RelatedDocumentCandidate {
  _id: Types.ObjectId;
  title: string;
  documentType: string;
  originalName: string;
  category: string;
  tags: string[];
  aiSummary?: string;
  uploadedAt: Date;
}

const RELATED_TYPE_GROUPS = [
  ['contract', 'agreement', 'nda', 'invoice', 'project', 'proposal', 'scope', 'sow'],
  ['gst', 'tax', 'certificate', 'registration', 'government', 'compliance'],
  ['bank', 'statement', 'payment', 'invoice', 'receipt', 'financial'],
];

const RELATED_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'document',
  'documents',
  'certificate',
  'contract',
  'agreement',
  'invoice',
  'receipt',
  'statement',
  'registration',
  'project',
  'client',
  'copy',
  'final',
  'signed',
]);

function textForRelatedMatching(document: {
  title?: string;
  originalName?: string;
  documentType?: string;
  category?: string;
  tags?: string[];
  aiSummary?: string;
}) {
  return [
    document.title,
    document.originalName,
    document.documentType,
    document.category,
    ...(document.tags || []),
    document.aiSummary,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function extractRelatedTerms(text: string): string[] {
  const terms = text
    .replace(/[_-]/g, ' ')
    .match(/[a-z0-9]{3,}/g) || [];

  return Array.from(new Set(terms.filter((term) => !RELATED_STOP_WORDS.has(term)))).slice(0, 30);
}

function getRelatedTypeTerms(documentType = '', tags: string[] = [], text = ''): Set<string> {
  const haystack = `${documentType} ${tags.join(' ')} ${text}`.toLowerCase();
  const terms = new Set<string>();

  for (const group of RELATED_TYPE_GROUPS) {
    if (group.some((term) => haystack.includes(term))) {
      group.forEach((term) => terms.add(term));
    }
  }

  return terms;
}

function scoreRelatedDocument(
  source: RelatedDocumentCandidate,
  candidate: RelatedDocumentCandidate,
  sourceTerms: Set<string>,
  sourceTypeTerms: Set<string>
) {
  let score = 0;
  const candidateText = textForRelatedMatching(candidate);
  const candidateTags = new Set(candidate.tags.map((tag) => tag.toLowerCase()));

  if (candidate.category === source.category) score += 3;
  if (candidate.documentType === source.documentType) score += 2;

  for (const tag of source.tags) {
    if (candidateTags.has(tag.toLowerCase())) score += 3;
  }

  for (const term of sourceTerms) {
    if (candidateText.includes(term)) score += 2;
  }

  for (const typeTerm of sourceTypeTerms) {
    if (candidateText.includes(typeTerm)) score += 1;
  }

  return score;
}

export async function getRelatedDocuments(
  userId: string,
  sourceDocument: RelatedDocumentCandidate
) {
  const sourceText = textForRelatedMatching(sourceDocument);
  const sourceTerms = new Set(extractRelatedTerms(sourceText));
  const sourceTypeTerms = getRelatedTypeTerms(
    sourceDocument.documentType,
    sourceDocument.tags,
    sourceText
  );

  const candidates = await DocumentModel.find({
    userId,
    _id: { $ne: sourceDocument._id },
    status: 'ready',
  })
    .select('-extractedText')
    .lean();

  return candidates
    .map((candidate) => ({
      document: candidate,
      score: scoreRelatedDocument(
        sourceDocument,
        candidate as RelatedDocumentCandidate,
        sourceTerms,
        sourceTypeTerms
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.document.uploadedAt).getTime() - new Date(a.document.uploadedAt).getTime();
    })
    .slice(0, 8)
    .map(({ document }) => document);
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
