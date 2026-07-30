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
  await fetch(presigned.upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  return registerMedia({
    object_key: presigned.object_key,
    content_type: file.type,
    ...related,
    ...proof,
  });
}
