import mongoose, { Document, Schema, Types } from 'mongoose';
import { DocumentStatus } from '../types';

export interface IDocument extends Document {
  userId: Types.ObjectId;
  title: string;
  documentType: string;
  uploadedBy: string;
  fileType: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  category: string;
  folderId?: Types.ObjectId;
  tags: string[];
  versionGroupKey: string;
  versionNumber: number;
  versionLabel: string;
  isLatestVersion: boolean;
  status: DocumentStatus;
  extractedText?: string;
  aiSummary?: string;
  extractedData?: Record<string, unknown>;
  chunkCount: number;
  errorMessage?: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    documentType: { type: String, required: true, default: 'Other' },
    uploadedBy: { type: String, required: true },
    fileType: { type: String, required: true, default: 'PDF' },
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    category: { type: String, required: true, index: true },
    folderId: { type: Schema.Types.ObjectId, ref: 'Folder', index: true },
    tags: { type: [String], default: [], index: true },
    versionGroupKey: { type: String, required: true, index: true },
    versionNumber: { type: Number, required: true, default: 1 },
    versionLabel: { type: String, required: true, default: 'v1' },
    isLatestVersion: { type: Boolean, required: true, default: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'failed', 'pending_ocr'],
      default: 'pending',
    },
    extractedText: { type: String },
    aiSummary: { type: String },
    extractedData: { type: Schema.Types.Mixed },
    chunkCount: { type: Number, default: 0 },
    errorMessage: { type: String },
    uploadedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

documentSchema.index({ userId: 1, title: 'text', originalName: 'text', extractedText: 'text', tags: 'text', documentType: 'text' });
documentSchema.index({ userId: 1, versionGroupKey: 1, versionNumber: -1 });

export const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);
