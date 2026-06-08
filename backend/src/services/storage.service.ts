import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { StoredFile } from '../types';

export interface StorageService {
  saveFile(file: Express.Multer.File, userId: string): Promise<StoredFile>;
  deleteFile(filePath: string): Promise<void>;
  getAbsolutePath(relativePath: string): string;
}

class LocalStorageService implements StorageService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), env.uploadDir);
  }

  async saveFile(file: Express.Multer.File, userId: string): Promise<StoredFile> {
    const userDir = path.join(this.baseDir, userId);
    await fs.mkdir(userDir, { recursive: true });

    const ext = path.extname(file.originalname);
    const fileName = `${uuidv4()}${ext}`;
    const filePath = path.join(userDir, fileName);

    await fs.writeFile(filePath, file.buffer);

    const relativePath = path.join(userId, fileName).replace(/\\/g, '/');
    const fileUrl = `/uploads/${relativePath}`;

    return {
      fileName,
      filePath: relativePath,
      fileUrl,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  async deleteFile(relativePath: string): Promise<void> {
    const absolutePath = this.getAbsolutePath(relativePath);
    try {
      await fs.unlink(absolutePath);
    } catch {
      // File may already be deleted
    }
  }

  getAbsolutePath(relativePath: string): string {
    return path.join(this.baseDir, relativePath);
  }
}

export const storageService: StorageService = new LocalStorageService();
