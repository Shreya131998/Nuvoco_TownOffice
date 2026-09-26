/* eslint-disable @next/next/no-img-element -- Cloudinary already serves a
   resized, auto-format image (see lib/cloudinary-client.ts), so next/image
   would only add Vercel's metered optimizer. Running at zero cost is a
   requirement of this project, not an oversight. */

import { Play } from "lucide-react";
import { fit, thumb } from "@/lib/cloudinary-client";

/**
 * The attachments on one record, as a row of thumbnails.
 *
 * Each opens the full-size file in a new tab rather than a lightbox: on a
 * phone the browser's own viewer already does pinch-zoom and share, and a
 * video wants the native player, not one reimplemented here.
 *
 * The video tile is a still frame Cloudinary renders from the clip, marked
 * with a play badge — a grey box would give no sense of what was filmed.
 */
export function MediaStrip({
  photos,
  video,
  size = 96,
}: {
  photos: string[];
  video?: string | null;
  size?: number;
}) {
  const items = [
    ...photos.map((url) => ({ url, isVideo: false })),
    ...(video ? [{ url: video, isVideo: true }] : []),
  ];
  if (items.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((m) => (
        <li key={m.url}>
          <a
            href={m.isVideo ? m.url : fit(m.url)}
            target="_blank"
            rel="noreferrer"
            className="relative block overflow-hidden rounded-lg border border-border"
            style={{ width: size, height: size }}
          >
            <img
              src={thumb(m.url, size * 2, size * 2)}
              alt={m.isVideo ? "Attached video" : "Attached photo"}
              className="size-full object-cover"
            />
            {m.isVideo && (
              <span className="absolute inset-0 grid place-items-center bg-black/30">
                <span className="grid size-8 place-items-center rounded-full bg-black/70 text-white">
                  <Play size={16} fill="currentColor" />
                </span>
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
