"use client";

import { idbDelete, idbGetAll, idbPut } from "./db";
import { ApiError } from "@/lib/api/client";
import { createIncident, type CreateIncidentInput } from "@/lib/api/incidents";
import { submitResult, type SubmitResultInput } from "@/lib/api/collation";
import { uploadFile, type CaptureProof } from "@/lib/api/media";
import { checkIn, checkOut, updateStatus, triggerDistress } from "@/lib/api/officers";
import { uuid } from "@/lib/uuid";
import { toast } from "sonner";
import type { PUStatus } from "@/types";

// This whole module runs silently by design (a background sync attempt
// failing shouldn't interrupt the agent with an error every 15 seconds),
// but silent also meant undiagnosable -- there was no way to tell, from
// the outside, whether a flush attempt ran at all, found nothing to do,
// or ran and failed for a reason nobody could see. Every attempt logs
// its outcome here so that's visible in devtools without needing to
// reproduce the bug with breakpoints.
function log(...args: unknown[]) {
  console.debug("[offline-queue]", ...args);
}

// Two things get queued here: the final incident/result submission when
// it fails due to no connection, AND (see QueuedMedia below) any photo/
// voice-note/vote-sheet blob that failed to upload for the same reason.
// A queued incident/result can reference not-yet-uploaded media by its
// local pending id (see PENDING_PREFIX in the uploader components) --
// flushQueue resolves all pending media to real media_ids first, then
// only replays an incident/result once every id it references is real.
// This is what makes "attach evidence while offline, submit, walk away"
// actually deliver the evidence once back online, instead of only saving
// the text fields and quietly dropping the photo.

interface QueuedIncident {
  id: string;
  kind: "incident";
  createdAt: number;
  input: CreateIncidentInput;
}

interface QueuedResult {
  id: string;
  kind: "result";
  createdAt: number;
  input: SubmitResultInput;
}

// Check-in/out, a status update, and a distress alert are all short
// "officer pings" rather than evidence-bearing reports -- no media, no
// text fields to draft -- but they fail exactly the same way (no
// connection) and deserve the exact same "saved on this device, will
// send automatically" treatment instead of just an error toast that
// loses the agent's action the moment they navigate away.
interface QueuedCheckIn {
  id: string;
  kind: "checkin";
  createdAt: number;
  input: { lat: number; lng: number };
}

interface QueuedCheckOut {
  id: string;
  kind: "checkout";
  createdAt: number;
}

interface QueuedStatus {
  id: string;
  kind: "status";
  createdAt: number;
  input: { pu_code: string; status: PUStatus; note?: string };
}

interface QueuedDistress {
  id: string;
  kind: "distress";
  createdAt: number;
  input: { pu_code: string; lat: number; lng: number };
}

export type QueuedSubmission =
  | QueuedIncident
  | QueuedResult
  | QueuedCheckIn
  | QueuedCheckOut
  | QueuedStatus
  | QueuedDistress;

/** A local id prefixed this way is a placeholder for a blob that hasn't
 * uploaded yet -- not a real server-side media id. Used as both the
 * IndexedDB key for the stored blob and the placeholder value uploader
 * components put in their media_ids list, so resolving one resolves the
 * other. */
export const PENDING_MEDIA_PREFIX = "local:";

interface QueuedMedia {
  id: string;
  kind: "media";
  createdAt: number;
  blob: Blob;
  name: string;
  contentType: string;
  relatedType: "incident" | "result";
  proof?: CaptureProof;
}

type Listener = (queue: QueuedSubmission[]) => void;
const listeners = new Set<Listener>();

type SyncListener = (syncing: boolean) => void;
const syncListeners = new Set<SyncListener>();
let syncing = false;

function setSyncing(v: boolean) {
  syncing = v;
  syncListeners.forEach((fn) => fn(v));
}

/** Fires immediately with the current in-progress state, then on every
 * change -- lets any page show "Syncing…" the moment a flush actually
 * starts doing work, not just a static pending count. */
export function subscribeSyncing(fn: SyncListener): () => void {
  syncListeners.add(fn);
  fn(syncing);
  return () => syncListeners.delete(fn);
}

/** Attached media count, for a UI list to show "2 photos" etc. without
 * each page re-deriving it -- only incident/result carry media at all. */
export function mediaCountOf(item: QueuedSubmission): number {
  return (item.kind === "incident" || item.kind === "result") ? (item.input.media_ids?.length ?? 0) : 0;
}

/** The submission queue only, never raw media blobs -- media items are an
 * implementation detail underneath a still-queued submission, not
 * something the "N pending" badge needs to count separately (see
 * flushQueue: a submission never sits queued-but-fully-resolved, since
 * handleSubmit routes straight to the queue whenever it references
 * unresolved media, live-network-blip or not). Sorted oldest-first --
 * IndexedDB's key order (a random uuid) has no relationship to when
 * something was actually queued, and replaying a check-in/out or status
 * sequence out of order could leave the server in the wrong end state. */
async function getSubmissionQueue(): Promise<QueuedSubmission[]> {
  const all = await idbGetAll<QueuedSubmission | QueuedMedia>();
  return all.filter((i): i is QueuedSubmission => i.kind !== "media").sort((a, b) => a.createdAt - b.createdAt);
}

async function notify() {
  const queue = await getSubmissionQueue();
  listeners.forEach((fn) => fn(queue));
}

/** Fires immediately with the current queue, then on every change. */
export function subscribeQueue(fn: Listener): () => void {
  listeners.add(fn);
  getSubmissionQueue()
    .then(fn)
    .catch(() => {});
  return () => {
    listeners.delete(fn);
  };
}

/** True for a genuine network-level failure (fetch itself couldn't
 * complete) OR a transient/recoverable server condition -- an expired
 * session (401), a permissions hiccup (403), rate limiting (429), or a
 * server-side error (5xx) all mean "try again later," not "this data is
 * bad." Retrying the exact same payload after those resolve (re-login,
 * the server recovers) should still succeed, so none of them are safe to
 * treat as a permanent rejection. Only a genuine 4xx validation failure
 * (400, 422, ...) means the server looked at this data specifically and
 * will never accept it -- that's the only case worth dropping instead of
 * leaving queued. */
function isRetriable(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true;
  return err.status === 401 || err.status === 403 || err.status === 429 || err.status >= 500;
}

/** A 401 means the session itself is dead, not just this one request --
 * every other authenticated call in this flush pass would fail the same
 * way, so it's not worth grinding through the rest of the queue
 * one-by-one. SessionExpiredDialog is already telling the agent to log
 * back in; the next flush (triggered by the offline queue badge
 * remounting after re-login, or the periodic retry) picks up right where
 * this one stopped. */
function isSessionExpired(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export async function queueIncident(input: CreateIncidentInput): Promise<void> {
  await idbPut<QueuedIncident>({ id: uuid(), kind: "incident", createdAt: Date.now(), input });
  await notify();
}

export async function queueResult(input: SubmitResultInput): Promise<void> {
  await idbPut<QueuedResult>({ id: uuid(), kind: "result", createdAt: Date.now(), input });
  await notify();
}

export async function queueCheckIn(lat: number, lng: number): Promise<void> {
  await idbPut<QueuedCheckIn>({ id: uuid(), kind: "checkin", createdAt: Date.now(), input: { lat, lng } });
  await notify();
}

export async function queueCheckOut(): Promise<void> {
  await idbPut<QueuedCheckOut>({ id: uuid(), kind: "checkout", createdAt: Date.now() });
  await notify();
}

export async function queueStatus(puCode: string, status: PUStatus, note?: string): Promise<void> {
  await idbPut<QueuedStatus>({
    id: uuid(),
    kind: "status",
    createdAt: Date.now(),
    input: { pu_code: puCode, status, note },
  });
  await notify();
}

export async function queueDistress(puCode: string, lat: number, lng: number): Promise<void> {
  await idbPut<QueuedDistress>({
    id: uuid(),
    kind: "distress",
    createdAt: Date.now(),
    input: { pu_code: puCode, lat, lng },
  });
  await notify();
}

/** Stores a blob that failed to upload due to no connection, returning a
 * placeholder id the caller can use in a media_ids list right away --
 * the actual upload happens later, transparently, via flushQueue. */
export async function queueMedia(
  file: File,
  relatedType: "incident" | "result",
  proof?: CaptureProof,
): Promise<string> {
  const id = PENDING_MEDIA_PREFIX + uuid();
  await idbPut<QueuedMedia>({
    id,
    kind: "media",
    createdAt: Date.now(),
    blob: file,
    name: file.name,
    contentType: file.type,
    relatedType,
    proof,
  });
  return id;
}

/** Drops a still-pending media blob (e.g. the agent removed the
 * attachment before it ever uploaded) -- without this it would sit in
 * IndexedDB forever with nothing left referencing it. */
export async function dequeueMedia(id: string): Promise<void> {
  await idbDelete(id);
}

/** Reads one still-queued blob's display metadata (and the blob itself,
 * for playback/preview) without removing it. A fresh mount of an uploader
 * component has no memory of its own -- this is how it rebuilds its item
 * list for a draft's already-queued attachments after the page that
 * queued them was left and come back to, instead of showing nothing and
 * leaving the blob orphaned in IndexedDB with nothing pointing at it. */
export async function peekQueuedMedia(
  id: string,
): Promise<{ name: string; contentType: string; blob: Blob; proof?: CaptureProof } | undefined> {
  const all = await idbGetAll<QueuedSubmission | QueuedMedia>();
  const item = all.find((i): i is QueuedMedia => i.kind === "media" && i.id === id);
  return item ? { name: item.name, contentType: item.contentType, blob: item.blob, proof: item.proof } : undefined;
}

/** Attempts to upload every pending media blob, returning a map of
 * resolved local id -> real server media id for whichever succeeded.
 * Anything still offline, or blocked by a retriable server condition, is
 * left in place for next time; only a genuine validation rejection is
 * dropped rather than retried forever. Stops immediately on a 401 --
 * see isSessionExpired -- rather than burning through every other queued
 * blob with the same dead token. */
async function resolvePendingMedia(): Promise<{ resolved: Map<string, string>; sessionExpired: boolean }> {
  const resolved = new Map<string, string>();
  const all = await idbGetAll<QueuedSubmission | QueuedMedia>();
  const pending = all.filter((i): i is QueuedMedia => i.kind === "media");
  for (const item of pending) {
    try {
      const file = new File([item.blob], item.name, { type: item.contentType });
      const media = await uploadFile(file, { related_type: item.relatedType }, item.proof);
      resolved.set(item.id, media.id);
      await idbDelete(item.id);
      log(`uploaded queued media ${item.id} -> ${media.id}`);
    } catch (err) {
      if (isSessionExpired(err)) {
        log(`media ${item.id} hit a 401 -- session expired, stopping this flush pass`);
        return { resolved, sessionExpired: true };
      }
      if (isRetriable(err)) {
        log(`media ${item.id} still can't upload, leaving queued:`, err);
        continue;
      }
      log(`media ${item.id} permanently rejected, dropping:`, err);
      await idbDelete(item.id);
    }
  }
  return { resolved, sessionExpired: false };
}

function replaceMediaIds(ids: string[] | undefined, resolved: Map<string, string>): string[] | undefined {
  return ids?.map((id) => resolved.get(id) ?? id);
}

function hasUnresolvedMedia(ids: string[] | undefined): boolean {
  return (ids ?? []).some((id) => id.startsWith(PENDING_MEDIA_PREFIX));
}

let flushing = false;

/** Sends one item -- for incident/result, `item.input.media_ids` must
 * already be patched with resolved real ids by the caller before this is
 * called. Throws on failure, same as the underlying API call, so the
 * caller's existing retriable/session-expired/permanent handling applies
 * uniformly to every kind without repeating it six times. */
async function sendOne(item: QueuedSubmission): Promise<void> {
  switch (item.kind) {
    case "incident":
      await createIncident(item.input);
      return;
    case "result":
      await submitResult(item.input);
      return;
    case "checkin":
      await checkIn(item.input.lat, item.input.lng);
      return;
    case "checkout":
      await checkOut();
      return;
    case "status":
      await updateStatus(item.input.pu_code, item.input.status, item.input.note);
      return;
    case "distress":
      await triggerDistress(item.input.pu_code, item.input.lat, item.input.lng);
      return;
  }
}

/** Resolves any pending media blobs first, patches the results into
 * whatever queued incidents/results referenced them, then replays
 * everything in strict chronological order -- this matters beyond just
 * "fairness": check-in/check-out/distress all set the same
 * officer.status field, so replaying them out of order could leave the
 * server showing a stale state (e.g. a checkout that happened before a
 * distress alert must not be allowed to land after it and overwrite it
 * back to "offline"). A genuine send failure (network/session/server)
 * still stops the whole pass there, since if that failed, nothing behind
 * it will succeed either. The one thing that does NOT stop the pass is
 * an incident/result still waiting on its own media upload -- that's
 * skipped (not abandoned; it stays queued) so it can never hold up an
 * unrelated, unblocked item queued after it, most importantly a distress
 * alert stuck behind someone else's slow photo. */
export async function flushQueue(): Promise<void> {
  if (flushing) {
    log("flush already in progress, skipping this trigger");
    return;
  }
  const all = await idbGetAll<QueuedSubmission | QueuedMedia>();
  if (all.length === 0) {
    log("triggered, nothing queued");
    return;
  }
  log(`triggered with ${all.length} item(s) queued, navigator.onLine=${typeof navigator !== "undefined" ? navigator.onLine : "n/a"}`);

  flushing = true;
  setSyncing(true);
  let syncedCount = 0;
  try {
    const { resolved, sessionExpired } = await resolvePendingMedia();
    if (sessionExpired) return;
    const queue = await getSubmissionQueue();
    for (const item of queue) {
      // For incident/result, patch in whatever media just got resolved
      // above before sending -- and if sending still fails for a
      // retriable reason, persist that patched version so the next flush
      // doesn't need resolvePendingMedia to re-supply an id whose
      // QueuedMedia record is already gone (deleted the moment it
      // uploaded successfully).
      let toSend: QueuedSubmission = item;
      if (item.kind === "incident" || item.kind === "result") {
        const mediaIds = replaceMediaIds(item.input.media_ids, resolved);
        if (hasUnresolvedMedia(mediaIds)) {
          log(`${item.kind} ${item.id} still references unresolved media, skipping for now (not blocking the rest)`);
          continue;
        }
        toSend = { ...item, input: { ...item.input, media_ids: mediaIds } } as QueuedSubmission;
      }
      try {
        await sendOne(toSend);
        await idbDelete(item.id);
        syncedCount++;
        log(`synced ${item.kind} ${item.id}`);
      } catch (err) {
        if (isSessionExpired(err)) {
          log(`${item.kind} ${item.id} hit a 401 -- session expired, stopping this flush pass`);
          break;
        }
        if (isRetriable(err)) {
          log(`${item.kind} ${item.id} still can't send, leaving queued:`, err);
          if (toSend !== item) await idbPut(toSend);
          break;
        }
        // A real validation rejection: drop it rather than retry forever,
        // but don't silently lose it -- surface it as failed so the
        // agent knows to redo it manually.
        log(`${item.kind} ${item.id} permanently rejected, dropping:`, err);
        await idbDelete(item.id);
      }
    }
  } catch (err) {
    log("flush pass threw unexpectedly:", err);
  } finally {
    flushing = false;
    setSyncing(false);
    await notify();
    log(`flush pass done, synced ${syncedCount}`);
    if (syncedCount > 0) {
      toast.success(`${syncedCount} pending report${syncedCount > 1 ? "s" : ""} synced to the dashboard`);
    }
  }
}

// Every trigger here is a cheap no-op when the queue is empty (flushQueue
// bails immediately), so there's no cost to checking often and from every
// angle -- the goal is that an agent should basically never need the
// manual "Sync now" button; it's there as a fallback for the offline
// signal genuinely lying (see isRetriable's comment on why 401 isn't
// treated as "connected"), not as the primary way this is expected to work.
if (typeof window !== "undefined") {
  // The most common real path back online for a phone: it was locked or
  // backgrounded while out of signal, regains it, and the agent reopens
  // the app or switches back to this tab -- neither of which reliably
  // fires a plain `online` event on every mobile browser.
  window.addEventListener("online", () => flushQueue());
  window.addEventListener("focus", () => flushQueue());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) flushQueue();
  });
  // Backstop for everything else (a connection that quietly comes back
  // without the tab ever losing and regaining focus) -- frequent enough
  // to feel immediate, cheap enough that it doesn't matter that most
  // ticks find nothing to do.
  setInterval(() => flushQueue(), 15000);
}
