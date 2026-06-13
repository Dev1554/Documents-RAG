import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { storageService } from './storage.service';
import { AppError } from '../utils/AppError';
import { needsOcrFallback, ocrFromImage, ocrFromPdf } from './ocr.service';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff'];

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface TextExtractionResult {
  text: string;
  pages: ExtractedPage[];
}

export async function extractText(filePath: string, mimeType: string): Promise<TextExtractionResult> {
  const absolutePath = storageService.getAbsolutePath(filePath);

  if (mimeType === 'application/pdf') {
    const buffer = await fs.readFile(absolutePath);
    const pages: ExtractedPage[] = [];
    
    const options = {
      pagerender: (pageData: any) => {
        return pageData.getTextContent({
          normalizeWhitespace: false,
          disableCombineTextItems: false,
        }).then((textContent: any) => {
          let lastY: number | undefined;
          let text = '';
          for (const item of textContent.items) {
            if (lastY === item.transform[5] || !lastY) {
              text += item.str;
            } else {
              text += '\n' + item.str;
            }
            lastY = item.transform[5];
          }
          pages.push({
            pageNumber: pageData.pageIndex + 1,
            text: text.trim(),
          });
          return text;
        });
      },
    };

    const data = await pdfParse(buffer, options);
    pages.sort((a, b) => a.pageNumber - b.pageNumber);

    const nativeText = data.text.trim();
    if (needsOcrFallback(nativeText)) {
      return ocrFromPdf(absolutePath);
    }

    return {
      text: nativeText,
      pages,
    };
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const buffer = await fs.readFile(absolutePath);
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    return {
      text,
      pages: [{ pageNumber: 1, text }],
    };
  }

  if (mimeType === 'text/plain') {
    const content = await fs.readFile(absolutePath, 'utf-8');
    const text = content.trim();
    return {
      text,
      pages: [{ pageNumber: 1, text }],
    };
  }

  if (IMAGE_MIME_TYPES.includes(mimeType)) {
    return ocrFromImage(absolutePath);
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
