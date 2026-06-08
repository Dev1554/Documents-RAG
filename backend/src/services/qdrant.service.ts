import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { QdrantPayload } from '../types';

const client = new QdrantClient({
  url: env.qdrantUrl,
  checkCompatibility: false,
});

export async function ensureQdrantCollection(): Promise<void> {
  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === env.qdrantCollection);

  if (!exists) {
    await client.createCollection(env.qdrantCollection, {
      vectors: {
        size: env.embeddingDimensions,
        distance: 'Cosine',
      },
    });
    console.log(`Qdrant collection "${env.qdrantCollection}" created`);
  }
}

export async function upsertVectors(
  points: Array<{
    id: string;
    vector: number[];
    payload: QdrantPayload;
  }>
): Promise<void> {
  if (points.length === 0) return;

  await client.upsert(env.qdrantCollection, {
    wait: true,
    points: points.map((p) => ({
      id: p.id,
      vector: p.vector,
      payload: p.payload,
    })),
  });
}

export async function deleteDocumentVectors(documentId: string): Promise<void> {
  await client.delete(env.qdrantCollection, {
    wait: true,
    filter: {
      must: [{ key: 'documentId', match: { value: documentId } }],
    },
  });
}

export interface VectorSearchFilter {
  userId: string;
  category?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  payload: QdrantPayload;
}

export async function searchVectors(
  vector: number[],
  filter: VectorSearchFilter,
  limit: number = 10
): Promise<VectorSearchResult[]> {
  const must: Array<Record<string, unknown>> = [
    { key: 'userId', match: { value: filter.userId } },
  ];

  if (filter.category) {
    must.push({ key: 'category', match: { value: filter.category } });
  }

  if (filter.tags && filter.tags.length > 0) {
    must.push({ key: 'tags', match: { any: filter.tags } });
  }

  if (filter.dateFrom || filter.dateTo) {
    const range: Record<string, string> = {};
    if (filter.dateFrom) range.gte = filter.dateFrom;
    if (filter.dateTo) range.lte = filter.dateTo;
    must.push({ key: 'uploadedAt', range });
  }

  const results = await client.search(env.qdrantCollection, {
    vector,
    limit,
    filter: { must },
    with_payload: true,
  });

  return results.map((r) => ({
    id: String(r.id),
    score: r.score,
    payload: r.payload as unknown as QdrantPayload,
  }));
}

export function generatePointId(): string {
  return uuidv4();
}
