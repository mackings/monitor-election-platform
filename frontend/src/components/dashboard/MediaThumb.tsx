import type { Media } from "@/types";
import { cn } from "@/lib/utils";
import { ShieldCheck, Mic } from "lucide-react";

export function MediaThumb({ media, size = "md" }: { media: Media; size?: "sm" | "md" }) {
  const isVideo = media.content_type.startsWith("video/");
  const isAudio = media.content_type.startsWith("audio/");

  const verifiedTitle = media.sha256
    ? `Tamper-evident capture\nFingerprint: ${media.sha256.slice(0, 16)}…\nCaptured: ${
        media.captured_at ? new Date(media.captured_at).toLocaleString() : "unknown"
      }${media.captured_lat != null ? `\nLocation: ${media.captured_lat.toFixed(5)}, ${media.captured_lng?.toFixed(5)}` : ""}`
    : undefined;

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      title={verifiedTitle}
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900",
        size === "sm" ? "h-14 w-14" : "h-20 w-20",
      )}
    >
      {isVideo ? (
        <video src={media.url} className="h-full w-full object-cover" muted />
      ) : isAudio ? (
        <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-slate-500">
          <Mic className="h-6 w-6" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt="Evidence" className="h-full w-full object-cover" />
      )}
      {media.sha256 && (
        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
          <ShieldCheck className="h-2.5 w-2.5" />
        </span>
      )}
    </a>
  );
}
