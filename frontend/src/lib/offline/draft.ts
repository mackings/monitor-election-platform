"use client";

/** localStorage-backed persistence for an in-progress field form -- a
 * report/result sheet the agent is still filling out (hasn't hit Submit
 * yet) needs to survive leaving the page and coming back, or an
 * accidental refresh, the same way an already-submitted-but-offline item
 * survives via the IndexedDB queue. Drafts are cleared the moment the
 * form is actually submitted (live or queued) -- from then on the queue
 * is the source of truth, not this. */
function safeStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export function saveDraft<T>(key: string, value: T): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable (private browsing) -- the draft just
    // won't survive navigation this time; not worth surfacing an error
    // for what's a convenience feature layered on top of the real,
    // durable offline queue.
  }
}

export function loadDraft<T>(key: string): T | null {
  const storage = safeStorage();
  if (!storage) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  safeStorage()?.removeItem(key);
}
