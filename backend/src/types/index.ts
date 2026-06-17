import { Request } from 'express';
import { Types } from 'mongoose';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface DocumentFilters {
  keyword?: string;
  category?: string;
  folderId?: string;
  includeNested?: boolean;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  uploadedBy?: string;
  year?: number;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  category: string;
  tags: string[];
  content: string;
  score: number;
  chunkIndex: number;
  pageNumber?: number;
}

export interface ChatSource {
  documentId: string;
  documentName: string;
  category: string;
  content: string;
  score: number;
  pageNumber?: number;
}

export interface StoredFile {
  fileName: string;
  filePath: string;
  fileUrl: string;
  mimeType: string;
  size: number;
}

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'pending_ocr';

export interface QdrantPayload {
  chunkId: string;
  documentId: string;
  userId: string;
  documentName: string;
  documentType?: string;
  uploadedBy?: string;
  category: string;
  tags: string[];
  chunkIndex: number;
  uploadedAt: string;
  pageNumber?: number;
  [key: string]: unknown;
}

export type ObjectId = Types.ObjectId;
