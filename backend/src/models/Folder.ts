import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFolder extends Document {
  userId: Types.ObjectId;
  name: string;
  parentId: Types.ObjectId | null;
  path: string;
  depth: number;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const folderSchema = new Schema<IFolder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
    path: { type: String, required: true, index: true },
    depth: { type: Number, required: true, default: 0 },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

folderSchema.index({ userId: 1, parentId: 1, name: 1 }, { unique: true });
folderSchema.index({ userId: 1, path: 1 });

export const FolderModel = mongoose.model<IFolder>('Folder', folderSchema);
