"use client";

/* eslint-disable @next/next/no-img-element -- Cloudinary already serves a
   resized, auto-format image (see lib/cloudinary-client.ts), so next/image
   would only add Vercel's metered optimizer. Running at zero cost is a
   requirement of this project, not an oversight. */

import { useRef, useState } from "react";
import { ImageOff, Loader2, Plus, Video, X } from "lucide-react";
import { compressImage, prettyBytes } from "@/lib/compress";
import { isVideo, thumb } from "@/lib/cloudinary-client";

export type UploadedMedia = { url: string; publicId: string };

export type MediaValue = {
  photos: UploadedMedia[];
  video: UploadedMedia | null;
};

export const EMPTY_MEDIA: MediaValue = { photos: [], video: null };

/**
 * Photos and video on one control.
 *
 * Nothing here passes through our server: the browser asks
 * /api/upload-signature for a signature, then POSTs each file straight to
 * Cloudinary. That sidesteps the 4.5 MB serverless body cap — which a video
 * would breach on its own — and keeps every byte off metered function
 * bandwidth.
 *
 * One button, not one per source. `capture` would send a phone straight to
 * the camera and skip the gallery, and with video in the mix that split would
 * have become four buttons. Leaving the attribute off lets the phone offer
 * its own sheet — camera, camcorder, library, files — which is both shorter
 * and more familiar than anything reinvented here.
 *
 * Images are shrunk on a canvas first. Video is not: there is no practical
 * way to re-encode in the browser, which is exactly why it is capped at one.
 */
export function MediaField({
  value,
  onChange,
  enabled = true,
  maxPhotos,
  maxVideoBytes,
  label = "Add photos or a video",
  labelHi = "फोटो या वीडियो जोड़ें",
}: {
  value: MediaValue;
  onChange: (v: MediaValue) => void;
  enabled?: boolean;
  maxPhotos: number;
  maxVideoBytes: number;
  label?: string;
  labelHi?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const photosLeft = maxPhotos - value.photos.length;
  const full = photosLeft <= 0 && value.video !== null;

  async function uploadOne(file: File): Promise<UploadedMedia> {
    const video = file.type.startsWith("video/");
    const payload = video ? file : await compressImage(file);

    if (video && payload.size > maxVideoBytes) {
      throw new Error(
        `That video is ${prettyBytes(payload.size)}. The limit is ${prettyBytes(maxVideoBytes)}.`
      );
    }
    if (!video && payload.size > 10 * 1024 * 1024) {
      throw new Error("That image is too large. Please try a different photo.");
    }

    const sigRes = await fetch("/api/upload-signature", { method: "POST" });
    const sig = await sigRes.json();
    if (!sigRes.ok) throw new Error(sig.error ?? "Upload is unavailable");

    const body = new FormData();
    body.append("file", payload);
    body.append("api_key", sig.apiKey);
    body.append("timestamp", String(sig.timestamp));
    body.append("folder", sig.folder);
    body.append("signature", sig.signature);

    // resource_type lives in the path, not in the signed parameters, so the
    // same signature covers both endpoints.
    const kind = video ? "video" : "image";
    const up = await fetch(
      `https://api.cloudinary.com/v1_1/${sig.cloudName}/${kind}/upload`,
      { method: "POST", body }
    );
    const json = await up.json();
    if (!up.ok) throw new Error(json?.error?.message ?? "Upload failed");

    return { url: json.secure_url, publicId: json.public_id };
  }

  async function pick(files: FileList) {
    setErr(null);
    const chosen = [...files];

    // Work out what will fit before uploading anything, so the resident is
    // told up front rather than after a slow upload is discarded.
    const videos = chosen.filter((f) => f.type.startsWith("video/"));
    const images = chosen.filter((f) => !f.type.startsWith("video/"));

    if (videos.length > 1 || (videos.length === 1 && value.video)) {
      setErr("Only one video per complaint. / एक शिकायत में एक ही वीडियो।");
      return;
    }
    if (images.length > photosLeft) {
      setErr(
        `You can add ${maxPhotos} photos in total. / कुल ${maxPhotos} फोटो जोड़ सकते हैं।`
      );
      return;
    }

    const next: MediaValue = { photos: [...value.photos], video: value.video };

    try {
      for (const file of [...images, ...videos]) {
        setBusy(file.name);
        const up = await uploadOne(file);
        if (isVideo(up.url)) next.video = up;
        else next.photos.push(up);
        // Commit after each file: a slow second upload should not hide the
        // first one, and a failure part-way keeps what already succeeded.
        onChange({ photos: [...next.photos], video: next.video });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  const removePhoto = (url: string) =>
    onChange({ ...value, photos: value.photos.filter((p) => p.url !== url) });

  if (!enabled) {
    return (
      <div>
        <Label label={label} labelHi={labelHi} />
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border-strong bg-surface-2 px-4 py-4 text-sm">
          <ImageOff size={20} className="mt-0.5 shrink-0 text-muted" />
          <div className="min-w-0">
            <p className="font-medium text-muted">Uploads are switched off</p>
            <p className="hi text-xs text-muted">अपलोड अभी बंद है</p>
            <p className="mt-1 text-xs text-muted">
              Add the three <code className="rounded bg-surface px-1">CLOUDINARY_</code>{" "}
              values to <code className="rounded bg-surface px-1">.env.local</code>{" "}
              and restart. Free account, no card — see the README.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label label={label} labelHi={labelHi} />

      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) void pick(e.target.files);
        }}
      />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.photos.map((p) => (
          <Tile
            key={p.url}
            url={p.url}
            onRemove={() => removePhoto(p.url)}
            removeLabel="Remove photo"
          />
        ))}

        {value.video && (
          <Tile
            url={value.video.url}
            badge
            onRemove={() => onChange({ ...value, video: null })}
            removeLabel="Remove video"
          />
        )}

        {busy && (
          <div className="grid aspect-square place-items-center rounded-lg border border-dashed border-border-strong text-muted">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}

        {!full && !busy && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="grid aspect-square place-items-center rounded-lg border border-dashed border-border-strong text-muted transition hover:border-primary hover:text-primary"
          >
            <span className="grid place-items-center gap-1 text-center">
              <Plus size={22} />
              <span className="text-[0.7rem] font-medium leading-tight">Add</span>
            </span>
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-muted">
        Up to {maxPhotos} photos and one video, from the camera or your gallery.
        <span className="hi block">
          {maxPhotos} फोटो और एक वीडियो तक — कैमरा या गैलरी से।
        </span>
      </p>

      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}

function Label({ label, labelHi }: { label: string; labelHi: string }) {
  return (
    <span className="mb-1.5 flex flex-wrap items-baseline gap-1.5 text-sm font-medium">
      {label} <span className="hi text-muted">/ {labelHi}</span>
      <span className="text-xs font-normal text-muted">(optional)</span>
    </span>
  );
}

function Tile({
  url,
  badge,
  onRemove,
  removeLabel,
}: {
  url: string;
  badge?: boolean;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-border">
      <img
        src={thumb(url, 240, 240)}
        alt=""
        className="size-full object-cover"
      />
      {badge && (
        <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white">
          <Video size={11} />
          Video
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/70 text-white"
      >
        <X size={14} />
      </button>
    </div>
  );
}
