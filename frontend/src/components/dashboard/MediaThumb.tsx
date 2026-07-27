import type { Media } from "@/types";
import { cn } from "@/lib/utils";

export function MediaThumb({ media, size = "md" }: { media: Media; size?: "sm" | "md" }) {
  const isVideo = media.content_type.startsWith("video/");
  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900",
        size === "sm" ? "h-14 w-14" : "h-20 w-20",
      )}
    >
      {isVideo ? (
        <video src={media.url} className="h-full w-full object-cover" muted />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt="Evidence" className="h-full w-full object-cover" />
      )}
    </a>
  );
}
