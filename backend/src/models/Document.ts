import mongoose, { Document, Schema, Types } from 'mongoose';
import { DocumentStatus } from '../types';

export interface IDocument extends Document {
  userId: Types.ObjectId;
  fileName: string;
  originalName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  category: string;
  tags: string[];
  status: DocumentStatus;
  extractedText?: string;
  chunkCount: number;
  errorMessage?: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    category: { type: String, required: true, index: true },
    tags: { type: [String], default: [], index: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'failed', 'pending_ocr'],
      default: 'pending',
    },
    extractedText: { type: String },
    chunkCount: { type: Number, default: 0 },
    errorMessage: { type: String },
    uploadedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

documentSchema.index({ userId: 1, originalName: 'text', extractedText: 'text', tags: 'text' });

export const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);
