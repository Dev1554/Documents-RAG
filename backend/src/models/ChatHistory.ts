import mongoose, { Document, Schema, Types } from 'mongoose';
import { ChatSource } from '../types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  createdAt: Date;
}

export interface IChatHistory extends Document {
  userId: Types.ObjectId;
  question: string;
  answer: string;
  sources: ChatSource[];
  messages: ChatMessage[];
  isPinned: boolean;
  isArchived: boolean;
  pinnedAt?: Date;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const chatHistorySchema = new Schema<IChatHistory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    messages: [
      {
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        sources: [
          {
            documentId: { type: String, required: true },
            documentName: { type: String, required: true },
            category: { type: String, required: true },
            content: { type: String, required: true },
            score: { type: Number, required: true },
            pageNumber: { type: Number, default: 1 },
          },
        ],
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isPinned: { type: Boolean, default: false, index: true },
    isArchived: { type: Boolean, default: false, index: true },
    pinnedAt: { type: Date },
    archivedAt: { type: Date },
    sources: [
      {
        documentId: { type: String, required: true },
        documentName: { type: String, required: true },
        category: { type: String, required: true },
        content: { type: String, required: true },
        score: { type: Number, required: true },
        pageNumber: { type: Number, default: 1 },
      },
    ],
  },
  { timestamps: true }
);

chatHistorySchema.index({ userId: 1, isArchived: 1, isPinned: -1, pinnedAt: -1, createdAt: -1 });

export const ChatHistory = mongoose.model<IChatHistory>('ChatHistory', chatHistorySchema);
