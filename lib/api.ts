import { NextResponse } from "next/server";

/** These endpoints are reachable by anyone with the form URL, so every
 *  field is validated here rather than trusted from the client. */

export class BadRequest extends Error {}

/** An unknown complaint token. Distinct from BadRequest so /resolve can say
 *  "we have no record of that token" rather than "that token is malformed". */
export class NotFound extends Error {}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function str(v: unknown, field: string, max = 200): string {
  if (typeof v !== "string" || !v.trim()) throw new BadRequest(`${field} is required`);
  const s = v.trim();
  if (s.length > max) throw new BadRequest(`${field} is too long`);
  return s;
}

/**
 * A person's typed name. Names are free text (no staff list), so the dashboard
 * groups on whatever is entered. Trim and collapse inner whitespace so
 * "ramesh   kumar" and "ramesh kumar " are the same person. Case and spelling
 * are left alone — normalising further would mangle names like "O.P SINGH".
 */
export function personName(v: unknown, field: string): string {
  return str(v, field, 80).replace(/\s+/g, " ");
}

/**
 * An Indian mobile number. Digits only after stripping spaces, dashes and an
 * optional +91 / 0 prefix; must be 10 digits starting 6-9. Residents type these
 * in every style imaginable, so normalise rather than reject.
 */
export function mobile(v: unknown, field: string): string {
  if (typeof v !== "string") throw new BadRequest(`${field} is required`);
  const digits = v.replace(/[\s\-()]/g, "").replace(/^(\+91|91|0)/, "");
  if (!/^[6-9]\d{9}$/.test(digits)) {
    throw new BadRequest(`${field} must be 10 digits, starting with 6-9`);
  }
  return digits;
}

export function optStr(v: unknown, field: string, max = 2000): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") throw new BadRequest(`${field} must be text`);
  const s = v.trim();
  if (!s) return null;
  if (s.length > max) throw new BadRequest(`${field} is too long`);
  return s;
}

export function uuid(v: unknown, field: string): string {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new BadRequest(`${field} is invalid`);
  return v;
}

export function optUuid(v: unknown, field: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  return uuid(v, field);
}

export function date(v: unknown, field: string): string {
  if (typeof v !== "string" || !DATE_RE.test(v) || Number.isNaN(Date.parse(v)))
    throw new BadRequest(`${field} must be a valid date`);
  return v;
}

export function optDate(v: unknown, field: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  return date(v, field);
}

export function int(v: unknown, field: string, min = 0, max = 9999): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new BadRequest(`${field} must be a whole number between ${min} and ${max}`);
  return n;
}

export function optInt(v: unknown, field: string, min = 0, max = 9999): number | null {
  if (v === null || v === undefined || v === "") return null;
  return int(v, field, min, max);
}

export function arr<T>(v: unknown, field: string, max: number): T[] {
  if (!Array.isArray(v)) throw new BadRequest(`${field} is invalid`);
  if (v.length > max) throw new BadRequest(`${field} has too many entries`);
  return v as T[];
}

export function bool(v: unknown, field: string): boolean {
  if (typeof v !== "boolean") throw new BadRequest(`${field} must be true or false`);
  return v;
}

/**
 * Optional single shared staff code. Blank env var = pages stay fully open,
 * which is the configured default: /resolve is keyed on the complaint token.
 * Set STAFF_ACCESS_CODE if it turns out residents are closing their own
 * complaints.
 */
export function checkAccessCode(req: Request) {
  const expected = process.env.STAFF_ACCESS_CODE;
  if (!expected) return;
  if (req.headers.get("x-staff-code") !== expected)
    throw new BadRequest("Invalid staff access code");
}

export function fail(e: unknown) {
  if (e instanceof BadRequest) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  if (e instanceof NotFound) {
    return NextResponse.json({ error: e.message }, { status: 404 });
  }
  console.error("[api]", e);
  return NextResponse.json(
    { error: "Could not save. Please try again." },
    { status: 500 }
  );
}
