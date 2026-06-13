import fs from 'fs/promises';
import path from 'path';
import { createCanvas } from 'canvas';
import { createWorker, Worker } from 'tesseract.js';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export interface OcrPage {
  pageNumber: number;
  text: string;
}

export interface OcrResult {
  text: string;
  pages: OcrPage[];
}

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker(env.ocrLang);
      return worker;
    })();
  }

  return workerPromise;
}

async function recognizeImageBuffer(imageBuffer: Buffer): Promise<string> {
  if (env.ocrProvider !== 'tesseract') {
    throw new AppError(`Unsupported OCR provider: ${env.ocrProvider}`, 500);
  }

  const worker = await getWorker();
  const result = await worker.recognize(imageBuffer);
  return result.data.text.trim();
}

export async function ocrFromImage(absolutePath: string): Promise<OcrResult> {
  const imageBuffer = await fs.readFile(absolutePath);
  const text = await recognizeImageBuffer(imageBuffer);

  return {
    text,
    pages: [{ pageNumber: 1, text }],
  };
}

async function loadPdfJs() {
  const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const workerSrc = path.join(pdfjsDistPath, 'legacy/build/pdf.worker.mjs');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  return pdfjs;
}

async function renderPdfPageToBuffer(page: any): Promise<Buffer> {
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  return canvas.toBuffer('image/png');
}

export async function ocrFromPdf(absolutePath: string): Promise<OcrResult> {
  const pdfjs = await loadPdfJs();
  const buffer = await fs.readFile(absolutePath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages, env.ocrMaxPdfPages);
  const pages: OcrPage[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const imageBuffer = await renderPdfPageToBuffer(page);
    const text = await recognizeImageBuffer(imageBuffer);
    pages.push({ pageNumber, text });
  }

  if (pdf.numPages > env.ocrMaxPdfPages) {
    console.warn(
      `PDF has ${pdf.numPages} pages; OCR limited to first ${env.ocrMaxPdfPages} pages.`
    );
  }

  return {
    text: pages.map((page) => page.text).join('\n\n').trim(),
    pages,
  };
}

export function needsOcrFallback(text: string): boolean {
  return text.trim().length < env.ocrMinTextLength;
}
