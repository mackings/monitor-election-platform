import { api } from "./client";
import type { Media, PresignedUpload } from "@/types";

export function presignUpload(contentType: string) {
  return api.post<PresignedUpload>("/api/v1/media/presign", { content_type: contentType });
}

export interface CaptureProof {
  sha256?: string;
  captured_at?: string;
  captured_lat?: number;
  captured_lng?: number;
}

export function registerMedia(
  input: {
    object_key: string;
    content_type: string;
    related_type?: "incident" | "result";
    related_id?: string;
  } & CaptureProof,
) {
  return api.post<Media>("/api/v1/media/register", input);
}

/** Resolves a batch of media IDs (e.g. an incident's media_ids) to their
 * viewable records/URLs in one call. */
export function getMediaBatch(ids: string[]) {
  if (ids.length === 0) return Promise.resolve<Media[]>([]);
  return api.get<Media[]>(`/api/v1/media?ids=${ids.map(encodeURIComponent).join(",")}`);
}

/** Presigns, PUTs the file straight to object storage, then registers the
 * resulting object as media. The API server never sees the file bytes.
 * `proof` carries the watermark/hash metadata for a tamper-evident
 * capture (see lib/media/watermark.ts) -- omitted for ordinary photo/
 * video/voice attachments that don't need it. */
export async function uploadFile(
  file: File,
  related?: { related_type: "incident" | "result"; related_id?: string },
  proof?: CaptureProof,
): Promise<Media> {
  const presigned = await presignUpload(file.type);
  // Scaled by file size rather than flat -- a raw camera photo or video
  // (MediaUploader, no recompression) can be many times larger than a
  // watermarked result-sheet photo (canvas-recompressed at 0.92 quality
  // in watermark.ts, typically much smaller) or a short voice note. A
  // flat timeout sized for the small case would abort a legitimately
  // slow-but-progressing large upload on a poor connection every single
  // retry, forever -- indistinguishable from "never syncs" even though
  // the connection genuinely is capable of finishing it, just not that
  // fast. This still bounds a truly dead connection (the original point
  // of having a timeout at all), just generously enough not to punish
  // exactly the attachments most likely to be large: incident photos/
  // videos.
  const timeoutMs = Math.min(300000, 30000 + (file.size / (1024 * 1024)) * 20000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  let res: Response;
  try {
    res = await fetch(presigned.upload_url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
      signal: controller.signal,
    });
  } catch (err) {
    console.debug(
      `[media-upload] ${file.name} (${sizeMb}MB) failed within ${(timeoutMs / 1000).toFixed(0)}s budget:`,
      err,
    );
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    // An HTTP-level rejection from storage (expired presigned URL, wrong
    // content-type, a transient 5xx) -- deliberately a plain Error, not
    // ApiError, so callers' isRetriable check (lib/offline/queue.ts)
    // treats this the same as a dropped connection and queues the file
    // for retry instead of silently registering a Media record for bytes
    // that were never actually stored.
    throw new Error(`Upload to storage failed (${res.status})`);
  }
  return registerMedia({
    object_key: presigned.object_key,
    content_type: file.type,
    ...related,
    ...proof,
  });
}
