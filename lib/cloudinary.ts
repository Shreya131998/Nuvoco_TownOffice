import "server-only";
import { createHash } from "node:crypto";

/**
 * Signed, direct-from-browser image uploads.
 *
 * The file never passes through this server. Two reasons: a serverless request
 * body is capped at 4.5 MB on Vercel, and function bandwidth is metered while
 * Cloudinary's is not. So the browser asks for a signature, uploads straight to
 * Cloudinary, and sends us back only the resulting URL.
 *
 * That last step is the one to be careful about — anything the browser hands
 * back is untrusted, so assertOurUrl() runs before a URL is written to the
 * sheet. Without it, a crafted payload could park any URL on the dashboard.
 */

export const UPLOAD_FOLDER = "townoffice/complaints";



export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export function cloudName(): string {
  const n = process.env.CLOUDINARY_CLOUD_NAME;
  if (!n) throw new Error("CLOUDINARY_CLOUD_NAME is not set");
  return n;
}

/**
 * Cloudinary's signature: the signed params sorted by key, joined as a query
 * string, with the API secret appended, then SHA-1. Only the params listed
 * here may be sent by the browser — anything else invalidates the signature,
 * which is what stops a caller from, say, overriding the folder.
 */
export function signUpload(timestamp: number): {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
} {
  const secret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  if (!secret || !apiKey) throw new Error("Cloudinary is not configured");

  const params: Record<string, string | number> = {
    folder: UPLOAD_FOLDER,
    timestamp,
  };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  return {
    cloudName: cloudName(),
    apiKey,
    timestamp,
    folder: UPLOAD_FOLDER,
    signature: createHash("sha1").update(toSign + secret).digest("hex"),
  };
}

/**
 * Accepts only a delivery URL on our own cloud. Returns the URL, or null when
 * the value is absent. Throws on anything else, so a bad value is a 400 rather
 * than a quietly poisoned row.
 */
export function assertOurUrl(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error(`${field} must be a URL`);

  const prefix = `https://res.cloudinary.com/${cloudName()}/`;
  if (!value.startsWith(prefix)) {
    throw new Error(`${field} must be an uploaded file`);
  }
  return value;
}

/**
 * The same check over a list, with a cap.
 *
 * The browser hands these back after uploading, so they are as untrusted as
 * anything else a form sends: one bad entry has to fail the whole submission
 * rather than slip into the sheet alongside the good ones.
 */
export function assertOurUrls(
  value: unknown,
  field: string,
  max: number
): string[] {
  if (value === null || value === undefined || value === "") return [];
  if (!Array.isArray(value)) throw new Error(`${field} is invalid`);
  if (value.length > max) throw new Error(`${field}: at most ${max} allowed`);
  return value.map((v) => {
    const url = assertOurUrl(v, field);
    if (!url) throw new Error(`${field} is invalid`);
    return url;
  });
}

// The URL transforms live in a client-safe module; re-exported here so server
// components can take everything Cloudinary-shaped from one import.
export {
  thumb,
  fit,
  isVideo,
  parseList,
  serialiseList,
  MAX_PHOTOS,
  MAX_VIDEO_BYTES,
} from "./cloudinary-client";
