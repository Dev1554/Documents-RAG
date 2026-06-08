const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export interface TextChunk {
  index: number;
  content: string;
  tokenCount: number;
}

export function chunkText(text: string): TextChunk[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    const content = normalized.slice(start, end).trim();

    if (content) {
      chunks.push({
        index,
        content,
        tokenCount: Math.ceil(content.length / 4),
      });
      index += 1;
    }

    if (end >= normalized.length) break;
    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}
