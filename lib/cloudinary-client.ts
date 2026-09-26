/**
 * Cloudinary URL helpers, safe on both sides of the boundary.
 *
 * Split out from lib/cloudinary.ts because that module is server-only — it
 * holds the API secret — while these are pure string transforms that the
 * forms need in the browser.
 */

/**
 * How much media one record may carry. Declared here rather than in
 * lib/cloudinary.ts because the forms need them and that module is
 * server-only — it holds the API secret.
 *
 * Four photos covers a problem from every useful angle. One video, because a
 * clip is the only thing here with a real running cost: an image is ~180 KB
 * after the browser shrinks it, a clip is tens of megabytes and cannot be
 * shrunk client-side. At 800 complaints a month, photos alone use a fraction
 * of Cloudinary's free allowance; uncapped video would not.
 */
export const MAX_PHOTOS = 4;
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

/** Cloudinary puts the kind in the delivery path, so the URL is self-describing. */
export function isVideo(url: string): boolean {
  return url.includes("/video/upload/");
}

/**
 * A cropped, auto-format delivery URL. Cloudinary does the resizing, so the
 * dashboard never ships a 200 KB original to draw a 96 px thumbnail and we
 * never touch Vercel's metered image optimizer.
 *
 * For a video this returns a still frame: swapping the extension for .jpg
 * makes Cloudinary render a poster from the clip, so a video tile looks like
 * the footage rather than a grey box.
 */
export function thumb(url: string, w = 240, h = 240): string {
  const t = `c_fill,w_${w},h_${h},q_auto,f_auto`;
  if (!isVideo(url)) return url.replace("/upload/", `/upload/${t}/`);
  return url
    .replace("/upload/", `/upload/${t}/`)
    .replace(/\.[^./]+$/, ".jpg");
}

/** Bounded rather than cropped — for the full-size view. */
export function fit(url: string, w = 1200): string {
  return url.replace("/upload/", `/upload/c_limit,w_${w},q_auto,f_auto/`);
}

/**
 * Photo lists live in one sheet cell, one URL per line.
 *
 * Blank cells, stray whitespace and the single-URL rows written before this
 * was a list all fall out of the same parse.
 */
export function parseList(cell: string | null | undefined): string[] {
  if (!cell) return [];
  return cell
    .split(/[\r\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function serialiseList(urls: string[]): string {
  return urls.filter(Boolean).join("\n");
}
