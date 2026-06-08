import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDocumentChunk extends Document {
  documentId: Types.ObjectId;
  userId: Types.ObjectId;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  qdrantPointId: string;
  createdAt: Date;
  updatedAt: Date;
}

const documentChunkSchema = new Schema<IDocumentChunk>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    chunkIndex: { type: Number, required: true },
    content: { type: String, required: true },
    tokenCount: { type: Number, default: 0 },
    qdrantPointId: { type: String, required: true },
  },
  { timestamps: true }
);

documentChunkSchema.index({ documentId: 1, chunkIndex: 1 });
documentChunkSchema.index({ content: 'text' });

export const DocumentChunk = mongoose.model<IDocumentChunk>('DocumentChunk', documentChunkSchema);
