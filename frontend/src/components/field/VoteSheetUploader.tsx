"use client";

import { useRef, useState } from "react";
import { uploadFile } from "@/lib/api/media";
import { watermarkAndHash } from "@/lib/media/watermark";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { Camera, X, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Item {
  id: string;
  mediaId: string;
  name: string;
  fingerprint: string;
  status: "stamping" | "uploading" | "done" | "error";
}

/** Like MediaUploader, but for the one photo that matters most: the
 * physical result sheet. Before upload, stamps a timestamp/PU/GPS
 * watermark onto the image and computes its SHA-256 -- a lightweight,
 * no-external-service "proof of submission" an admin can use to verify
 * the exact image wasn't altered after capture. */
export function VoteSheetUploader({
  puCode,
  onChange,
  onUploadingChange,
}: {
  puCode: string;
  onChange: (mediaIds: string[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const { locate } = useGeolocation();

  function notify(next: Item[]) {
    setItems(next);
    onChange(next.filter((i) => i.status === "done").map((i) => i.mediaId));
    onUploadingChange?.(next.some((i) => i.status === "stamping" || i.status === "uploading"));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const newItems: Item[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      mediaId: "",
      name: f.name,
      fingerprint: "",
      status: "stamping" as const,
    }));
    let working = [...items, ...newItems];
    notify(working);

    // One location fetch shared across this batch -- if it fails, the
    // watermark just omits coordinates rather than blocking the upload
    // or (worse) silently substituting an unrelated fallback location,
    // which would misrepresent where the photo was actually taken.
    let location: { lat: number; lng: number } | undefined;
    try {
      location = await locate({ enableHighAccuracy: true, timeoutMs: 15000 });
    } catch {
      // proceed without coordinates
    }

    await Promise.all(
      Array.from(files).map(async (file, idx) => {
        const item = newItems[idx];
        try {
          const { file: stamped, sha256, capturedAt } = await watermarkAndHash(file, {
            puCode,
            lat: location?.lat,
            lng: location?.lng,
          });
          working = working.map((i) => (i.id === item.id ? { ...i, status: "uploading", fingerprint: sha256.slice(0, 10) } : i));
          notify(working);

          const media = await uploadFile(
            stamped,
            { related_type: "result" },
            { sha256, captured_at: capturedAt, captured_lat: location?.lat, captured_lng: location?.lng },
          );
          working = working.map((i) => (i.id === item.id ? { ...i, mediaId: media.id, status: "done" } : i));
          notify(working);
        } catch {
          working = working.map((i) => (i.id === item.id ? { ...i, status: "error" } : i));
          notify(working);
          toast.error(`Couldn't process ${file.name}`);
        }
      }),
    );
  }

  function removeItem(id: string) {
    notify(items.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
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
        Photograph the result sheet
      </button>
      <p className="text-[11px] text-muted-foreground">
        The photo is stamped with the time, your PU, and location, and a tamper-evident fingerprint is
        recorded — proof this exact image was submitted from here.
      </p>

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800"
            >
              <span className="truncate">{item.name}</span>
              <div className="flex items-center gap-2">
                {item.status === "stamping" && <span className="text-muted-foreground">Stamping…</span>}
                {item.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
                {item.status === "done" && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span className="font-mono">{item.fingerprint}</span>
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
