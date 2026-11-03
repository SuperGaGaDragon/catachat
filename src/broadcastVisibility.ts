import type { Broadcast } from './types';

// Historical broadcasts remain in the database for audit and recovery. The
// public client intentionally starts a fresh announcement timeline with the
// CataChess Magazine launch campaign.
export const PUBLIC_BROADCAST_CUTOFF = '2026-11-03T00:00:00.000Z';

const cutoffMs = Date.parse(PUBLIC_BROADCAST_CUTOFF);

export function visibleBroadcasts<T extends Pick<Broadcast, 'created_at'>>(rows: T[]): T[] {
  return rows.filter(row => {
    const createdAt = Date.parse(row.created_at);
    return Number.isFinite(createdAt) && createdAt >= cutoffMs;
  });
}
