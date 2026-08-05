"use client";

import { useEffect, useRef, useState } from "react";
import { uploadFile, getMediaBatch } from "@/lib/api/media";
import { ApiError } from "@/lib/api/client";
import { queueMedia, dequeueMedia, peekQueuedMedia, PENDING_MEDIA_PREFIX } from "@/lib/offline/queue";
import { uuid } from "@/lib/uuid";
import { Mic, Square, Trash2, Loader2, CheckCircle2, Play, Pause, CloudOff } from "lucide-react";
import { toast } from "sonner";

interface VoiceNote {
  id: string;
  mediaId: string;
  url: string;
  durationLabel: string;
  status: "uploading" | "done" | "error" | "queued";
}

/** Picks the best-supported recording format -- Chrome/Firefox/Android
 * default to webm/opus, Safari/iOS (14.3+) only supports mp4/aac. Falling
 * through to the browser's own default (no mimeType at all) covers
 * anything older that supports MediaRecorder but not either explicit
 * type string. */
function pickMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({
  relatedType,
  initialMediaIds,
  onChange,
  onUploadingChange,
}: {
  relatedType: "incident" | "result";
  /** Restores this recorder's displayed note list from a persisted draft
   * -- see MediaUploader's identical prop for why this exists. */
  initialMediaIds?: string[];
  onChange: (mediaIds: string[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const ids = initialMediaIds ?? [];
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const localIds = ids.filter((id) => id.startsWith(PENDING_MEDIA_PREFIX));
      const realIds = ids.filter((id) => !id.startsWith(PENDING_MEDIA_PREFIX));
      const restored: VoiceNote[] = [];

      for (const id of localIds) {
        const meta = await peekQueuedMedia(id);
        if (meta) {
          restored.push({
            id: uuid(),
            mediaId: id,
            url: URL.createObjectURL(meta.blob),
            durationLabel: "",
            status: "queued",
          });
        }
      }
      if (realIds.length > 0) {
        try {
          const media = await getMediaBatch(realIds);
          for (const m of media) {
            restored.push({
              id: uuid(),
              mediaId: m.id,
              url: m.url,
              durationLabel: "",
              status: "done",
            });
          }
        } catch {
          // Best-effort restore -- see MediaUploader's identical catch.
        }
      }
      if (!cancelled && restored.length > 0) notify(restored);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function notify(next: VoiceNote[]) {
    setNotes(next);
    // See MediaUploader.notify for why "queued" (a local placeholder id,
    // resolved later by the offline queue) counts here too, while only
    // "uploading" blocks submission.
    onChange(next.filter((n) => n.status === "done" || n.status === "queued").map((n) => n.mediaId));
    onUploadingChange?.(next.some((n) => n.status === "uploading"));
  }

  async function startRecording() {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      toast.error("Voice recording needs a secure connection (HTTPS).");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice recording isn't supported on this device/browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => handleStopped(mimeType ?? recorder.mimeType);
      recorderRef.current = recorder;
      recorder.start();
      setElapsed(0);
      setRecording(true);
      // A tick counter rather than timestamp math -- avoids depending on
      // wall-clock time at all, which is all this needs for a display
      // that only has to be accurate to the second for a short recording.
      timerRef.current = setInterval(() => setElapsed((e) => e + 0.25), 250);
    } catch {
      toast.error("Couldn't access the microphone. Check your browser's permission for this site.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }

  async function handleStopped(mimeType: string) {
    const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
    if (blob.size === 0) return;

    const id = uuid();
    const durationLabel = formatDuration(elapsed);
    const url = URL.createObjectURL(blob);
    let working = [...notes, { id, mediaId: "", url, durationLabel, status: "uploading" as const }];
    notify(working);

    const ext = mimeType.includes("mp4") ? "m4a" : "webm";
    const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: blob.type });
    try {
      const media = await uploadFile(file, { related_type: relatedType });
      working = working.map((n) => (n.id === id ? { ...n, mediaId: media.id, status: "done" } : n));
      notify(working);
    } catch (err) {
      if (err instanceof ApiError) {
        working = working.map((n) => (n.id === id ? { ...n, status: "error" } : n));
        notify(working);
        toast.error("Voice note upload failed.");
        return;
      }
      // No connection -- save it for later instead of losing the
      // recording; flushQueue uploads it in the background.
      const localId = await queueMedia(file, relatedType);
      working = working.map((n) => (n.id === id ? { ...n, mediaId: localId, status: "queued" } : n));
      notify(working);
    }
  }

  function removeNote(id: string) {
    const note = notes.find((n) => n.id === id);
    if (note) URL.revokeObjectURL(note.url);
    if (note?.status === "queued") dequeueMedia(note.mediaId).catch(() => {});
    notify(notes.filter((n) => n.id !== id));
  }

  function togglePlay(note: VoiceNote) {
    if (playingId === note.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(note.url);
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    audio.play();
    setPlayingId(note.id);
  }

  return (
    <div className="space-y-2">
      {!recording ? (
        <button
          type="button"
          onClick={startRecording}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-4 text-sm font-medium text-slate-600 transition-colors hover:border-red-300 hover:bg-red-50/50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:border-red-500/40 dark:hover:bg-red-500/10"
        >
          <Mic className="h-4 w-4" />
          Record a voice note
        </button>
      ) : (
        <button
          type="button"
          onClick={stopRecording}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 py-4 text-sm font-medium text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          Recording {formatDuration(elapsed)} — tap to stop
          <Square className="h-4 w-4" />
        </button>
      )}

      {notes.length > 0 && (
        <ul className="space-y-1.5">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800"
            >
              <div className="flex items-center gap-2">
                {note.status === "done" && (
                  <button
                    type="button"
                    onClick={() => togglePlay(note)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm dark:bg-slate-700 dark:text-slate-200"
                    aria-label={playingId === note.id ? "Pause" : "Play"}
                  >
                    {playingId === note.id ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </button>
                )}
                <span>Voice note{note.durationLabel ? ` · ${note.durationLabel}` : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                {note.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
                {note.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                {note.status === "queued" && (
                  <span
                    className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
                    title="Saved on this device — will upload once you're back online"
                  >
                    <CloudOff className="h-3.5 w-3.5" />
                    Saved offline
                  </span>
                )}
                {note.status === "error" && <span className="text-red-500">Failed</span>}
                <button type="button" onClick={() => removeNote(note.id)} aria-label="Remove">
                  <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
