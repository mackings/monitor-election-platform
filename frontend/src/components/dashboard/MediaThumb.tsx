"use client";

import { useState } from "react";
import type { Media } from "@/types";
import { cn } from "@/lib/utils";
import { ShieldCheck, Mic, Share2, Check } from "lucide-react";
import { toast } from "sonner";

export function MediaThumb({ media, size = "md" }: { media: Media; size?: "sm" | "md" }) {
  const isVideo = media.content_type.startsWith("video/");
  const isAudio = media.content_type.startsWith("audio/");
  const [copied, setCopied] = useState(false);

  const verifiedTitle = media.sha256
    ? `Tamper-evident capture\nFingerprint: ${media.sha256.slice(0, 16)}…\nCaptured: ${
        media.captured_at ? new Date(media.captured_at).toLocaleString() : "unknown"
      }${media.captured_lat != null ? `\nLocation: ${media.captured_lat.toFixed(5)}, ${media.captured_lng?.toFixed(5)}` : ""}`
    : undefined;

  // Web Share API hands off to the OS share sheet (WhatsApp, email, etc.)
  // where it's available; everywhere else (most desktop browsers) falls
  // back to copying the link, since media.url is already a durable public
  // R2 URL -- no new backend endpoint needed for either path.
  async function handleShare() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ url: media.url, title: "Election Monitor evidence" });
      } catch {
        // User cancelled the share sheet -- not an error worth surfacing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(media.url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy the link — your browser blocked clipboard access.");
    }
  }

  return (
    <div
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900",
        size === "sm" ? "h-14 w-14" : "h-20 w-20",
      )}
    >
      <a href={media.url} target="_blank" rel="noopener noreferrer" title={verifiedTitle} className="block h-full w-full">
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
      </a>
      {media.sha256 && (
        <span className="pointer-events-none absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
          <ShieldCheck className="h-2.5 w-2.5" />
        </span>
      )}
      <button
        type="button"
        onClick={handleShare}
        title="Share this file"
        aria-label="Share this file"
        className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/80 focus-visible:opacity-100"
      >
        {copied ? <Check className="h-2.5 w-2.5" /> : <Share2 className="h-2.5 w-2.5" />}
      </button>
    </div>
  );
}
