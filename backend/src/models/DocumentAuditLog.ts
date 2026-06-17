import mongoose, { Document, Schema, Types } from 'mongoose';

export type DocumentAuditAction = 'uploaded' | 'viewed' | 'downloaded' | 'deleted';

export interface IDocumentAuditLog extends Document {
  documentId: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  userEmail: string;
  action: DocumentAuditAction;
  documentTitle: string;
  originalName: string;
  category: string;
  documentType: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const documentAuditLogSchema = new Schema<IDocumentAuditLog>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    action: {
      type: String,
      enum: ['uploaded', 'viewed', 'downloaded', 'deleted'],
      required: true,
      index: true,
    },
    documentTitle: { type: String, required: true },
    originalName: { type: String, required: true },
    category: { type: String, required: true },
    documentType: { type: String, required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

documentAuditLogSchema.index({ documentId: 1, createdAt: -1 });
documentAuditLogSchema.index({ userId: 1, createdAt: -1 });
documentAuditLogSchema.index({ action: 1, createdAt: -1 });

export const DocumentAuditLog = mongoose.model<IDocumentAuditLog>(
  'DocumentAuditLog',
  documentAuditLogSchema
);
