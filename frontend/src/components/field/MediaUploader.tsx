"use client";

import { useRef, useState } from "react";
import { uploadFile } from "@/lib/api/media";
import { ApiError } from "@/lib/api/client";
import { queueMedia, dequeueMedia } from "@/lib/offline/queue";
import { Camera, X, Loader2, CheckCircle2, CloudOff } from "lucide-react";
import { toast } from "sonner";

interface UploadedItem {
  id: string;
  mediaId: string;
  name: string;
  status: "uploading" | "done" | "error" | "queued";
}

export function MediaUploader({
  relatedType,
  onChange,
  onUploadingChange,
}: {
  relatedType: "incident" | "result";
  onChange: (mediaIds: string[]) => void;
  /** Fires whenever any attachment is mid-upload. A multi-MB photo can
   * take several seconds on a real connection — the parent form should
   * disable Submit while this is true, or it'll happily submit before
   * the upload (and its media_id) exists. */
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadedItem[]>([]);

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
      id: crypto.randomUUID(),
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

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-4 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10"
      >
        <Camera className="h-4 w-4" />
        Add photo or video
      </button>

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
