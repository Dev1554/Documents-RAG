import { Request } from 'express';
import { Types } from 'mongoose';
import { DocumentAuditAction, DocumentAuditLog } from '../models/DocumentAuditLog';
import { AuthUser } from '../types';

export interface AuditedDocumentSnapshot {
  _id: Types.ObjectId | string;
  title?: string;
  originalName?: string;
  category?: string;
  documentType?: string;
}

export async function recordDocumentAudit(
  action: DocumentAuditAction,
  user: AuthUser,
  document: AuditedDocumentSnapshot,
  req?: Request
) {
  try {
    await DocumentAuditLog.create({
      documentId: document._id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action,
      documentTitle: document.title || document.originalName || 'Untitled Document',
      originalName: document.originalName || document.title || 'Unknown file',
      category: document.category || 'Uncategorized',
      documentType: document.documentType || 'Other',
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    });
  } catch (error) {
    console.error('Failed to record document audit log:', error);
  }
}

export async function getDocumentAuditLogs(documentId: string, userId: string) {
  return DocumentAuditLog.find({ documentId, userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
}
