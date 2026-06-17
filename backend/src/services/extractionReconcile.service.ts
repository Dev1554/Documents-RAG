const IDENTIFIER_FIELD_KEYS = new Set([
  'gstNumber',
  'pan',
  'aadhaar',
  'aadhaarNumber',
  'accountNumber',
  'ifsc',
  'invoiceNumber',
  'phone',
  'phoneNumber',
  'mobile',
  'cin',
  'tan',
  'udyam',
  'referenceNumber',
  'transactionId',
  'chequeNumber',
]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactAlphanumeric(value: string): string {
  return value.replace(/[\s\-./]/g, '');
}

const GSTIN_PATTERN = /\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z][0-9A-Z][0-9A-Z]/i;

export function extractGstinCandidate(value: string): string | null {
  const compact = compactAlphanumeric(value).toUpperCase();
  const match = compact.match(GSTIN_PATTERN);
  return match ? match[0] : null;
}

function extendMatchInCompactSource(compactValue: string, compactSource: string): string | null {
  const idx = compactSource.indexOf(compactValue);
  if (idx === -1) return null;

  let end = idx + compactValue.length;
  while (end < compactSource.length && /[A-Za-z0-9]/.test(compactSource[end])) {
    end++;
  }

  const extended = compactSource.slice(idx, end);
  return extended.length > compactValue.length ? extended : null;
}

export function extractKnownIdentifiers(text: string): Record<string, string> {
  const found: Record<string, string> = {};

  const gstNumber = extractGstinCandidate(text);
  if (gstNumber) found.gstNumber = gstNumber;

  const panMatch = text.match(/\b([A-Z]{5}\d{4}[A-Z])\b/);
  if (panMatch) found.pan = panMatch[1].toUpperCase();

  const aadhaarMatch = text.match(/\b(\d{4}\s?\d{4}\s?\d{4})\b/);
  if (aadhaarMatch) found.aadhaarNumber = aadhaarMatch[1].replace(/\s/g, '');

  const ifscMatch = text.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/i);
  if (ifscMatch) found.ifsc = ifscMatch[1].toUpperCase();

  return found;
}

export function reconcileFieldValue(
  value: string,
  sourceText: string,
  fieldKey?: string
): string {
  const trimmed = value.trim();
  if (!trimmed) return value;

  const isIdentifierField = fieldKey ? IDENTIFIER_FIELD_KEYS.has(fieldKey) : false;
  const compactValue = compactAlphanumeric(trimmed);
  const hasMeaningfulDigits = /\d{4,}/.test(compactValue);

  if (!isIdentifierField && !hasMeaningfulDigits) {
    return value;
  }

  const compactSource = sourceText.replace(/\s+/g, '');
  const extended = extendMatchInCompactSource(compactValue, compactSource);
  if (extended) {
    if (fieldKey === 'gstNumber') {
      return extractGstinCandidate(extended) || extended;
    }
    return extended;
  }

  if (compactValue.length >= 4) {
    const pattern = new RegExp(`[A-Z0-9]*${escapeRegex(compactValue)}[A-Z0-9]*`, 'gi');
    let best = compactValue;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(compactSource)) !== null) {
      if (match[0].length > best.length) {
        best = match[0];
      }
    }
    if (best.length > compactValue.length) {
      if (fieldKey === 'gstNumber') {
        return extractGstinCandidate(best) || best;
      }
      return best;
    }
  }

  if (fieldKey === 'gstNumber') {
    return extractGstinCandidate(value) || value;
  }

  return value;
}

function mergeIdentifierFields(
  fields: Record<string, unknown>,
  regexFound: Record<string, string>
): Record<string, unknown> {
  const merged = { ...fields };

  for (const [key, regexValue] of Object.entries(regexFound)) {
    const existing = merged[key];
    if (typeof existing !== 'string' || !existing.trim()) {
      merged[key] = regexValue;
      continue;
    }

    const existingCompact = compactAlphanumeric(existing);
    const regexCompact = compactAlphanumeric(regexValue);
    if (
      regexCompact.length > existingCompact.length ||
      (existingCompact.length >= 4 && regexCompact.startsWith(existingCompact))
    ) {
      merged[key] = regexValue;
    }
  }

  return merged;
}

export function reconcileExtractedData(
  extractedData: Record<string, unknown>,
  sourceText: string
): Record<string, unknown> {
  const result = { ...extractedData };
  const regexFound = extractKnownIdentifiers(sourceText);

  if (result.fields && typeof result.fields === 'object' && !Array.isArray(result.fields)) {
    const fields = { ...(result.fields as Record<string, unknown>) };
    for (const [key, val] of Object.entries(fields)) {
      if (typeof val === 'string') {
        fields[key] = reconcileFieldValue(val, sourceText, key);
      }
    }
    result.fields = mergeIdentifierFields(fields, regexFound);
  } else if (Object.keys(regexFound).length > 0) {
    result.fields = regexFound;
  }

  if (Array.isArray(result.transactions)) {
    result.transactions = result.transactions.map((tx) => {
      if (!tx || typeof tx !== 'object') return tx;
      const row = { ...(tx as Record<string, unknown>) };
      for (const [key, val] of Object.entries(row)) {
        if (typeof val === 'string') {
          row[key] = reconcileFieldValue(val, sourceText, key);
        }
      }
      return row;
    });
  }

  return result;
}
