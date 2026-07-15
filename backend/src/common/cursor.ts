export interface DecodedCursor {
  createdAt: Date;
  id: string;
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString(
    'base64url',
  );
}

export function decodeCursor(cursor: string): DecodedCursor | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const separator = raw.lastIndexOf('|');
    if (separator === -1) return null;

    const createdAt = new Date(raw.slice(0, separator));
    const id = raw.slice(separator + 1);
    if (Number.isNaN(createdAt.getTime()) || id.length === 0) return null;

    return { createdAt, id };
  } catch {
    return null;
  }
}
