import { api } from "./client";
import type { Media, PresignedUpload } from "@/types";

export function presignUpload(contentType: string) {
  return api.post<PresignedUpload>("/api/v1/media/presign", { content_type: contentType });
}

export function registerMedia(input: {
  object_key: string;
  content_type: string;
  related_type?: "incident" | "result";
  related_id?: string;
}) {
  return api.post<Media>("/api/v1/media/register", input);
}

/** Resolves a batch of media IDs (e.g. an incident's media_ids) to their
 * viewable records/URLs in one call. */
export function getMediaBatch(ids: string[]) {
  if (ids.length === 0) return Promise.resolve<Media[]>([]);
  return api.get<Media[]>(`/api/v1/media?ids=${ids.map(encodeURIComponent).join(",")}`);
}

/** Presigns, PUTs the file straight to object storage, then registers the
 * resulting object as media. The API server never sees the file bytes. */
export async function uploadFile(
  file: File,
  related?: { related_type: "incident" | "result"; related_id?: string },
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
  });
}
