"use client";

import { useEffect, useRef, useState } from "react";
import { uploadFile, getMediaBatch } from "@/lib/api/media";
import { ApiError } from "@/lib/api/client";
import { queueMedia, dequeueMedia, peekQueuedMedia, PENDING_MEDIA_PREFIX } from "@/lib/offline/queue";
import { uuid } from "@/lib/uuid";
import { Camera, Video, Images, X, Loader2, CheckCircle2, CloudOff } from "lucide-react";
import { toast } from "sonner";

interface UploadedItem {
  id: string;
  mediaId: string;
  name: string;
  status: "uploading" | "done" | "error" | "queued";
}

export function MediaUploader({
  relatedType,
  initialMediaIds,
  onChange,
  onUploadingChange,
}: {
  relatedType: "incident" | "result";
  /** Restores this uploader's displayed item list from a persisted draft
   * (see lib/offline/draft.ts) -- without this, leaving the page after
   * attaching a photo and coming back shows an empty uploader even though
   * the blob is still safely queued in IndexedDB, since this component's
   * own item list is otherwise just in-memory state that a fresh mount
   * has no way to know about. Read once on mount, not reactively. */
  initialMediaIds?: string[];
  onChange: (mediaIds: string[]) => void;
  /** Fires whenever any attachment is mid-upload. A multi-MB photo can
   * take several seconds on a real connection — the parent form should
   * disable Submit while this is true, or it'll happily submit before
   * the upload (and its media_id) exists. */
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadedItem[]>([]);

  useEffect(() => {
    const ids = initialMediaIds ?? [];
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const localIds = ids.filter((id) => id.startsWith(PENDING_MEDIA_PREFIX));
      const realIds = ids.filter((id) => !id.startsWith(PENDING_MEDIA_PREFIX));
      const restored: UploadedItem[] = [];

      for (const id of localIds) {
        const meta = await peekQueuedMedia(id);
        if (meta) restored.push({ id: uuid(), mediaId: id, name: meta.name, status: "queued" });
      }
      if (realIds.length > 0) {
        try {
          const media = await getMediaBatch(realIds);
          for (const m of media) {
            restored.push({
              id: uuid(),
              mediaId: m.id,
              name: m.content_type.startsWith("video/") ? "Video" : "Photo",
              status: "done",
            });
          }
        } catch {
          // Best-effort restore -- a failed lookup just means those
          // already-uploaded attachments don't reappear in the list;
          // their ids are still in the draft, so submit still works.
        }
      }
      if (!cancelled && restored.length > 0) notify(restored);
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately restore once from whatever initialMediaIds was on
    // mount, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function notify(next: UploadedItem[]) {
    setItems(next);
    // "queued" items carry a local placeholder id, not a real media id --
    // included here (not just "done") so a submit that happens before
    // they've uploaded still references them, and the offline queue can
    // resolve the placeholder to a real id later. Submission is only
    // blocked on "uploading" (actively in flight); "queued" means this
    // component's job is done and the offline queue owns it from here.
    onChange(next.filter((i) => i.status === "done" || i.status === "queued").map((i) => i.mediaId));
    onUploadingChange?.(next.some((i) => i.status === "uploading"));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const newItems: UploadedItem[] = Array.from(files).map((f) => ({
      id: uuid(),
      mediaId: "",
      name: f.name,
      status: "uploading" as const,
    }));
    let working = [...items, ...newItems];
    notify(working);

    await Promise.all(
      Array.from(files).map(async (file, idx) => {
        const item = newItems[idx];
        try {
          const media = await uploadFile(file, { related_type: relatedType });
          working = working.map((i) => (i.id === item.id ? { ...i, mediaId: media.id, status: "done" } : i));
          notify(working);
        } catch (err) {
          if (err instanceof ApiError) {
            working = working.map((i) => (i.id === item.id ? { ...i, status: "error" } : i));
            notify(working);
            toast.error(`Upload failed: ${file.name}`);
            return;
          }
          // No connection, not a rejection -- save the file itself for
          // later instead of losing it. flushQueue uploads it in the
          // background and patches the real id into whatever this ends
          // up attached to once you're back online.
          const localId = await queueMedia(file, relatedType);
          working = working.map((i) => (i.id === item.id ? { ...i, mediaId: localId, status: "queued" } : i));
          notify(working);
        }
      }),
    );
  }

  function removeItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (item?.status === "queued") dequeueMedia(item.mediaId).catch(() => {});
    notify(items.filter((i) => i.id !== id));
  }

  // Reset the input's value after every pick -- otherwise capturing a
  // second photo/video with the same filename (very common: the camera
  // often reuses generic names) never fires a fresh change event.
  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      {/* Single-shot camera capture, forced into photo mode -- accept +
          capture together with `multiple` unset is what reliably opens
          the camera app itself rather than a file/gallery picker. */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onInputChange}
      />
      {/* Same idea but forced into video-recording mode -- a mixed
          "image/*,video/*" accept with `capture` set is unreliable across
          mobile browsers and in practice just falls back to the photo
          picker, which is why video recording wasn't reachable before. */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={onInputChange}
      />
      {/* No `capture` here -- this is the multi-select existing-files
          picker (gallery/camera roll), photos and videos alike. */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={onInputChange}
      />

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-3 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10"
        >
          <Camera className="h-4 w-4" />
          Photo
        </button>
        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-3 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10"
        >
          <Video className="h-4 w-4" />
          Video
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-3 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10"
        >
          <Images className="h-4 w-4" />
          Gallery
        </button>
      </div>

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800"
            >
              <span className="truncate">{item.name}</span>
              <div className="flex items-center gap-2">
                {item.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
                {item.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                {item.status === "queued" && (
                  <span
                    className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
                    title="Saved on this device — will upload once you're back online"
                  >
                    <CloudOff className="h-3.5 w-3.5" />
                    Saved offline
                  </span>
                )}
                {item.status === "error" && <span className="text-red-500">Failed</span>}
                <button type="button" onClick={() => removeItem(item.id)} aria-label="Remove">
                  <X className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
