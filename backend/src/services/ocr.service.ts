import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { createCanvas, loadImage } from 'canvas';
import { createWorker, PSM, Worker } from 'tesseract.js';
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

export function normalizeOcrText(text: string): string {
  let normalized = text.replace(/\r\n/g, '\n');

  // OCR often inserts spaces/newlines between digits in long identifiers.
  normalized = normalized.replace(/(\d)[\s\n]+(?=\d)/g, '$1');
  normalized = normalized.replace(/(\d{2,})[\s\n]+(\d{2,})/g, '$1$2');

  return normalized;
}

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker(env.ocrLang);
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        user_defined_dpi: '300',
        preserve_interword_spaces: '1',
      });
      return worker;
    })();
  }

  return workerPromise;
}

async function preprocessImageBuffer(imageBuffer: Buffer): Promise<Buffer> {
  const img = await loadImage(imageBuffer);
  const canvas = createCanvas(img.width, img.height);
  const context = canvas.getContext('2d');

  context.drawImage(img, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const contrast = 1.25;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const adjusted = Math.min(255, Math.max(0, (gray - 128) * contrast + 128));
    data[i] = adjusted;
    data[i + 1] = adjusted;
    data[i + 2] = adjusted;
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toBuffer('image/png');
}

async function recognizeImageBuffer(imageBuffer: Buffer): Promise<string> {
  if (env.ocrProvider !== 'tesseract') {
    throw new AppError(`Unsupported OCR provider: ${env.ocrProvider}`, 500);
  }

  const worker = await getWorker();
  const preprocessed = await preprocessImageBuffer(imageBuffer);
  const result = await worker.recognize(preprocessed);
  return normalizeOcrText(result.data.text.trim());
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
  const workerSrc = pathToFileURL(
    path.join(pdfjsDistPath, 'legacy/build/pdf.worker.mjs')
  ).href;
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  return pdfjs;
}

async function renderPdfPageToBuffer(page: any): Promise<Buffer> {
  const viewport = page.getViewport({ scale: env.ocrPdfScale });
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
