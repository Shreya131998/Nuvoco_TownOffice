/**
 * Cloudinary URL helpers, safe on both sides of the boundary.
 *
 * Split out from lib/cloudinary.ts because that module is server-only — it
 * holds the API secret — while these are pure string transforms that the
 * forms need in the browser.
 */

/**
 * A cropped, auto-format delivery URL. Cloudinary does the resizing, so the
 * dashboard never ships a 200 KB original to draw a 96 px thumbnail and we
 * never touch Vercel's metered image optimizer.
 */
export function thumb(url: string, w = 240, h = 240): string {
  return url.replace("/upload/", `/upload/c_fill,w_${w},h_${h},q_auto,f_auto/`);
}

/** Bounded rather than cropped — for the full-size view. */
export function fit(url: string, w = 1200): string {
  return url.replace("/upload/", `/upload/c_limit,w_${w},q_auto,f_auto/`);
}
