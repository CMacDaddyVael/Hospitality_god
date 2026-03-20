/**
 * Agent Activity Feed — shared helpers for logging and reading
 * proactive agent actions.
 *
 * Storage: each entry is persisted to a JSON array under the
 * localStorage key `hg_agent_activity`. Server-side cron endpoints
 * return activity entries in their response so the client can merge
 * them into localStorage on next load.
 */

export type ActivityType =
  | "audit"
  | "content"
  | "review"
  | "competitor"
  | "photo"
  | "optimization";

export interface ActivityEntry {
  id: string;
  timestamp: string; // ISO-8601
  action: string; // human-readable summary
  details: string; // longer description / data
  type: ActivityType;
  propertyId?: string;
  propertyName?: string;
}

const STORAGE_KEY = "hg_agent_activity";
const MAX_ENTRIES = 200; // rolling cap

/* ---------- helpers that run client-side only ---------- */

export function getActivityFeed(): ActivityEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function appendActivity(entry: ActivityEntry): void {
  if (typeof window === "undefined") return;
  const feed = getActivityFeed();
  feed.unshift(entry); // newest first
  if (feed.length > MAX_ENTRIES) feed.length = MAX_ENTRIES;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(feed));
}

export function mergeActivityBatch(entries: ActivityEntry[]): void {
  if (typeof window === "undefined") return;
  const feed = getActivityFeed();
  const existingIds = new Set(feed.map((e) => e.id));
  const newOnes = entries.filter((e) => !existingIds.has(e.id));
  const merged = [...newOnes, ...feed]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

export function clearActivityFeed(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/* ---------- helper that works server-side (no localStorage) ---------- */

let _batchId = 0;

export function makeEntry(
  action: string,
  details: string,
  type: ActivityType,
  propertyId?: string,
  propertyName?: string,
): ActivityEntry {
  _batchId++;
  return {
    id: `agent-${Date.now()}-${_batchId}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    action,
    details,
    type,
    propertyId,
    propertyName,
  };
}
