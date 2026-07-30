"use client";

import { idbDelete, idbGetAll, idbPut } from "./db";
import { ApiError } from "@/lib/api/client";
import { createIncident, type CreateIncidentInput } from "@/lib/api/incidents";
import { submitResult, type SubmitResultInput } from "@/lib/api/collation";

// Scope: this queues the final incident/result submission when it fails
// due to no connection -- not the photo/voice/vote-sheet uploads that
// happen before it (those already show their own per-item retry state in
// MediaUploader/VoiceRecorder/VoteSheetUploader). The single most painful
// data-loss moment is finishing a whole report and having it vanish
// because signal dropped right at submit; this fixes that specific
// moment without needing to persist raw file blobs offline too.

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

type Listener = (queue: QueuedSubmission[]) => void;
const listeners = new Set<Listener>();

async function notify() {
  const queue = await idbGetAll<QueuedSubmission>();
  listeners.forEach((fn) => fn(queue));
}

/** Fires immediately with the current queue, then on every change. */
export function subscribeQueue(fn: Listener): () => void {
  listeners.add(fn);
  idbGetAll<QueuedSubmission>()
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

let flushing = false;

/** Replays queued submissions in order, stopping at the first one that
 * still fails (leaves it and everything behind it queued for next time)
 * rather than reordering or dropping anything. */
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const queue = await idbGetAll<QueuedSubmission>();
    for (const item of queue) {
      try {
        if (item.kind === "incident") {
          await createIncident(item.input);
        } else {
          await submitResult(item.input);
        }
        await idbDelete(item.id);
      } catch (err) {
        if (isNetworkFailure(err)) break;
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
