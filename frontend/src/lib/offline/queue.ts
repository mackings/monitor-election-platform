"use client";

import { idbDelete, idbGetAll, idbPut } from "./db";
import { ApiError } from "@/lib/api/client";
import { createIncident, type CreateIncidentInput } from "@/lib/api/incidents";
import { submitResult, type SubmitResultInput } from "@/lib/api/collation";
import { uploadFile, type CaptureProof } from "@/lib/api/media";

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

export type QueuedSubmission = QueuedIncident | QueuedResult;

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

/** The submission queue only, never raw media blobs -- media items are an
 * implementation detail underneath a still-queued submission, not
 * something the "N pending" badge needs to count separately (see
 * flushQueue: a submission never sits queued-but-fully-resolved, since
 * handleSubmit routes straight to the queue whenever it references
 * unresolved media, live-network-blip or not). */
async function getSubmissionQueue(): Promise<QueuedSubmission[]> {
  const all = await idbGetAll<QueuedSubmission | QueuedMedia>();
  return all.filter((i): i is QueuedSubmission => i.kind !== "media");
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

/** True only for a genuine network-level failure (fetch itself couldn't
 * complete) -- an ApiError means the request reached the server and the
 * server said no, which retrying forever will never fix and which the
 * agent needs to see and act on now, not have silently swallowed. */
function isNetworkFailure(err: unknown): boolean {
  return !(err instanceof ApiError);
}

export async function queueIncident(input: CreateIncidentInput): Promise<void> {
  await idbPut<QueuedIncident>({ id: crypto.randomUUID(), kind: "incident", createdAt: Date.now(), input });
  await notify();
}

export async function queueResult(input: SubmitResultInput): Promise<void> {
  await idbPut<QueuedResult>({ id: crypto.randomUUID(), kind: "result", createdAt: Date.now(), input });
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
  const id = PENDING_MEDIA_PREFIX + crypto.randomUUID();
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

/** Attempts to upload every pending media blob, returning a map of
 * resolved local id -> real server media id for whichever succeeded.
 * Anything still offline is left in place for next time; a genuine
 * server rejection (ApiError) is dropped rather than retried forever. */
async function resolvePendingMedia(): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const all = await idbGetAll<QueuedSubmission | QueuedMedia>();
  const pending = all.filter((i): i is QueuedMedia => i.kind === "media");
  for (const item of pending) {
    try {
      const file = new File([item.blob], item.name, { type: item.contentType });
      const media = await uploadFile(file, { related_type: item.relatedType }, item.proof);
      resolved.set(item.id, media.id);
      await idbDelete(item.id);
    } catch (err) {
      if (isNetworkFailure(err)) continue;
      await idbDelete(item.id);
    }
  }
  return resolved;
}

function replaceMediaIds(ids: string[] | undefined, resolved: Map<string, string>): string[] | undefined {
  return ids?.map((id) => resolved.get(id) ?? id);
}

function hasUnresolvedMedia(ids: string[] | undefined): boolean {
  return (ids ?? []).some((id) => id.startsWith(PENDING_MEDIA_PREFIX));
}

let flushing = false;

/** Resolves any pending media blobs first, patches the results into
 * whatever queued incidents/results referenced them, then replays
 * submissions in order -- stopping at the first one that still can't go
 * (a genuine network failure, or it still references media that hasn't
 * finished uploading) and leaving it and everything behind it queued for
 * next time, rather than reordering or dropping anything. */
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const resolved = await resolvePendingMedia();
    const queue = await getSubmissionQueue();
    for (const item of queue) {
      const input = { ...item.input, media_ids: replaceMediaIds(item.input.media_ids, resolved) };
      if (hasUnresolvedMedia(input.media_ids)) break;
      try {
        if (item.kind === "incident") {
          await createIncident(input as CreateIncidentInput);
        } else {
          await submitResult(input as SubmitResultInput);
        }
        await idbDelete(item.id);
      } catch (err) {
        if (isNetworkFailure(err)) {
          // Persist the patched media_ids so next flush doesn't have to
          // re-resolve ids that already succeeded.
          await idbPut({ ...item, input });
          break;
        }
        // A real server rejection: drop it rather than retry forever,
        // but don't silently lose it -- surface it as failed so the
        // agent knows to redo it manually.
        await idbDelete(item.id);
      }
    }
  } finally {
    flushing = false;
    await notify();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushQueue();
  });
  // `online` doesn't fire reliably everywhere (flaky captive portals,
  // some mobile browsers) -- a periodic retry is the backstop.
  setInterval(() => {
    flushQueue();
  }, 30000);
}
