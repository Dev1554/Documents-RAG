import { DocumentFilters } from '../types';

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function caseInsensitiveExactRegex(value: string): RegExp {
  return new RegExp(`^${escapeRegex(value.trim())}$`, 'i');
}

export function applyDocumentMetadataFilters(
  query: Record<string, unknown>,
  filters: DocumentFilters
): void {
  if (filters.category) {
    query.category = caseInsensitiveExactRegex(filters.category);
  }

  if (filters.tags?.length) {
    query.tags = { $in: filters.tags.map((tag) => caseInsensitiveExactRegex(tag)) };
  }

  if (filters.uploadedBy) {
    query.uploadedBy = caseInsensitiveExactRegex(filters.uploadedBy);
  }

  if (filters.year) {
    const start = new Date(`${filters.year}-01-01T00:00:00.000Z`);
    const end = new Date(`${filters.year}-12-31T23:59:59.999Z`);
    query.uploadedAt = { $gte: start, $lte: end };
  } else if (filters.dateFrom || filters.dateTo) {
    query.uploadedAt = query.uploadedAt || {};
    const uploadedAt = query.uploadedAt as Record<string, Date>;
    if (filters.dateFrom) uploadedAt.$gte = filters.dateFrom;
    if (filters.dateTo) uploadedAt.$lte = filters.dateTo;
  }
}

export function hasMetadataFilters(filters: DocumentFilters): boolean {
  return Boolean(
    filters.category ||
      filters.tags?.length ||
      filters.uploadedBy ||
      filters.year ||
      filters.dateFrom ||
      filters.dateTo
  );
}
