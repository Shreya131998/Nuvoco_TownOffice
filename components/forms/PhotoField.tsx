"use client";

/* eslint-disable @next/next/no-img-element -- Cloudinary already serves a
   resized, auto-format image (see lib/cloudinary-client.ts), so next/image
   would only add Vercel's metered optimizer. Running at zero cost is a
   requirement of this project, not an oversight. */

import { useRef, useState } from "react";
import { Camera, Images, X, Loader2, ImageOff } from "lucide-react";
import { compressImage, prettyBytes } from "@/lib/compress";
import { thumb } from "@/lib/cloudinary-client";

export type UploadedPhoto = { url: string; publicId: string };

/**
 * Photo attachment.
 *
 * The file never touches our server: the browser asks /api/upload-signature
 * for a signature, then POSTs the image straight to Cloudinary. That sidesteps
 * the 4.5 MB serverless body cap and keeps every byte off metered function
 * bandwidth.
 *
 * Two buttons, one file input. `capture="environment"` sends a phone straight
 * to the rear camera, which suits someone standing in front of the problem —
 * but it also SKIPS the gallery entirely, so a resident who photographed the
 * leak an hour ago had no way to attach it. The attribute is therefore set
 * per button rather than fixed on the input.
 *
 * It is set imperatively, on the ref, immediately before .click(). A state
 * change would re-render a tick too late, and the click has to stay inside
 * the user gesture or the browser blocks the picker.
 *
 * When uploads are not configured the field still renders, disabled, saying
 * so. Hiding it entirely was worse: the feature looked missing rather than
 * switched off, and nobody could tell the difference from a bug.
 */
export function PhotoField({
  value,
  onChange,
  enabled = true,
  label = "Add a photo",
  labelHi = "फोटो जोड़ें",
}: {
  value: UploadedPhoto | null;
  onChange: (v: UploadedPhoto | null) => void;
  enabled?: boolean;
  label?: string;
  labelHi?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [size, setSize] = useState<number | null>(null);

  async function pick(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const small = await compressImage(file);
      setSize(small.size);

      // 10 MB after compression means something is very wrong (a RAW file, a
      // panorama). Fail here rather than making the resident wait for a
      // Cloudinary rejection.
      if (small.size > 10 * 1024 * 1024) {
        throw new Error("That image is too large. Please try a different photo.");
      }

      const sigRes = await fetch("/api/upload-signature", { method: "POST" });
      const sig = await sigRes.json();
      if (!sigRes.ok) throw new Error(sig.error ?? "Photo upload is unavailable");

      const body = new FormData();
      body.append("file", small);
      body.append("api_key", sig.apiKey);
      body.append("timestamp", String(sig.timestamp));
      body.append("folder", sig.folder);
      body.append("signature", sig.signature);

      const up = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: "POST", body }
      );
      const json = await up.json();
      if (!up.ok) throw new Error(json?.error?.message ?? "Upload failed");

      onChange({ url: json.secure_url, publicId: json.public_id });
      setPreview(json.secure_url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
      onChange(null);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  /**
   * `fromCamera` decides whether the phone opens the camera or the gallery.
   * On a desktop browser `capture` is ignored and both buttons open the same
   * file dialog, which is the right outcome there anyway.
   */
  function openPicker(fromCamera: boolean) {
    const el = input.current;
    if (!el) return;
    if (fromCamera) el.setAttribute("capture", "environment");
    else el.removeAttribute("capture");
    el.click();
  }

  function clear() {
    onChange(null);
    setPreview(null);
    setSize(null);
    setErr(null);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <span className="mb-1.5 flex items-baseline gap-1.5 text-sm font-medium">
        {label} <span className="hi text-muted">/ {labelHi}</span>
        <span className="text-xs font-normal text-muted">(optional)</span>
      </span>

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
        }}
      />

      {!enabled ? (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border-strong bg-surface-2 px-4 py-4 text-sm">
          <ImageOff size={20} className="mt-0.5 shrink-0 text-muted" />
          <div className="min-w-0">
            <p className="font-medium text-muted">Photo upload is switched off</p>
            <p className="hi text-xs text-muted">फोटो अपलोड अभी बंद है</p>
            <p className="mt-1 text-xs text-muted">
              Add the three <code className="rounded bg-surface px-1">CLOUDINARY_</code>{" "}
              values to <code className="rounded bg-surface px-1">.env.local</code>{" "}
              and restart. Free account, no card — see the README.
            </p>
          </div>
        </div>
      ) : value && preview ? (
        <div className="flex items-start gap-3 rounded-lg border border-border-strong bg-surface p-3">
          <img
            src={thumb(preview, 160, 160)}
            alt="Attached photo"
            width={80}
            height={80}
            className="size-20 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ok">Photo attached</p>
            <p className="hi text-xs text-muted">फोटो जुड़ गई</p>
            {size !== null && (
              <p className="mt-1 text-xs text-muted">{prettyBytes(size)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label="Remove photo"
            className="rounded-lg p-2 text-muted hover:bg-surface-2"
          >
            <X size={18} />
          </button>
        </div>
      ) : busy ? (
        <div className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface px-4 py-6 text-sm text-muted">
          <Loader2 size={24} className="animate-spin" />
          <span className="font-medium">Uploading…</span>
          <span className="hi text-xs">अपलोड हो रहा है…</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => openPicker(true)}
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface px-3 py-5 text-sm text-muted transition hover:border-primary hover:text-primary"
          >
            <Camera size={24} />
            <span className="font-medium">Take a photo</span>
            <span className="hi text-xs">फोटो लें</span>
          </button>
          <button
            type="button"
            onClick={() => openPicker(false)}
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface px-3 py-5 text-sm text-muted transition hover:border-primary hover:text-primary"
          >
            <Images size={24} />
            <span className="font-medium">From gallery</span>
            <span className="hi text-xs">गैलरी से चुनें</span>
          </button>
        </div>
      )}

      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
