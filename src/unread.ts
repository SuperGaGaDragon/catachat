const STORAGE_KEY = 'catachat_seen_channels_v1';
export const UNREAD_UPDATED_EVENT = 'catachat:unread-updated';

type SeenMap = Record<string, string>;

function parseMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function readSeenMap(): SeenMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SeenMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSeenMap(next: SeenMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota/write errors
  }
  window.dispatchEvent(new Event(UNREAD_UPDATED_EVENT));
}

function keyFor(channel: 'conv' | 'group' | 'broadcast', id: string): string {
  return `${channel}:${id}`;
}

function markSeen(key: string, seenAt?: string | null): void {
  const candidate = parseMs(seenAt) ?? Date.now();
  const map = readSeenMap();
  const current = parseMs(map[key]);
  if (current != null && candidate <= current) return;
  map[key] = new Date(candidate).toISOString();
  writeSeenMap(map);
}

function hasUnread(key: string, latestAt?: string | null): boolean {
  const latest = parseMs(latestAt);
  if (latest == null) return false;
  const seen = parseMs(readSeenMap()[key]);
  if (seen == null) return true;
  return latest > seen;
}

export function markConversationSeen(conversationId: string, seenAt?: string | null): void {
  markSeen(keyFor('conv', conversationId), seenAt);
}

export function markGroupSeen(groupId: string, seenAt?: string | null): void {
  markSeen(keyFor('group', groupId), seenAt);
}

export function markBroadcastSeen(seenAt?: string | null): void {
  markSeen(keyFor('broadcast', 'global'), seenAt);
}

export function hasConversationUnread(conversationId: string, latestAt?: string | null): boolean {
  return hasUnread(keyFor('conv', conversationId), latestAt);
}

export function hasGroupUnread(groupId: string, latestAt?: string | null): boolean {
  return hasUnread(keyFor('group', groupId), latestAt);
}

export function hasBroadcastUnread(latestAt?: string | null): boolean {
  return hasUnread(keyFor('broadcast', 'global'), latestAt);
}
