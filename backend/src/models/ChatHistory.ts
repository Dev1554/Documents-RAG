import mongoose, { Document, Schema, Types } from 'mongoose';
import { ChatSource } from '../types';

export interface IChatHistory extends Document {
  userId: Types.ObjectId;
  question: string;
  answer: string;
  sources: ChatSource[];
  createdAt: Date;
  updatedAt: Date;
}

const chatHistorySchema = new Schema<IChatHistory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    sources: [
      {
        documentId: { type: String, required: true },
        documentName: { type: String, required: true },
        category: { type: String, required: true },
        content: { type: String, required: true },
        score: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

export const ChatHistory = mongoose.model<IChatHistory>('ChatHistory', chatHistorySchema);
