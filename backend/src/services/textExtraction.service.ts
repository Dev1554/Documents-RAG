import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { storageService } from './storage.service';
import { AppError } from '../utils/AppError';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff'];

export async function extractText(filePath: string, mimeType: string): Promise<string> {
  const absolutePath = storageService.getAbsolutePath(filePath);

  if (mimeType === 'application/pdf') {
    const buffer = await fs.readFile(absolutePath);
    const data = await pdfParse(buffer);
    return data.text.trim();
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const buffer = await fs.readFile(absolutePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  if (mimeType === 'text/plain') {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return content.trim();
  }

  if (IMAGE_MIME_TYPES.includes(mimeType)) {
    return '';
  }

  throw new AppError(`Unsupported file type: ${mimeType}`, 400);
}

export function isImageMimeType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.includes(mimeType);
}

export function isSupportedMimeType(mimeType: string): boolean {
  const supported = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    ...IMAGE_MIME_TYPES,
  ];
  return supported.includes(mimeType);
}
