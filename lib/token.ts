/**
 * Complaint tokens.
 *
 * Six characters, nothing else: SHORT is the point. A resident reads this off
 * a cracked phone screen at the door and a technician types it back in, often
 * one-handed, so every extra character is a chance to get it wrong.
 *
 *   7K3M9P
 *
 * The alphabet is the digits and letters minus the four that get confused in
 * handwriting: the digits 0 and 1, and the letters I and O. What is left is
 * exactly 32 characters, which matters twice over — 256 divides by 32, so a
 * random byte maps to a character with no modulo bias, and each remaining
 * character is unambiguous. L stays in: with no digit 1 in the set there is
 * nothing for it to be confused with, and dropping it would leave 31 and
 * reintroduce the bias.
 *
 * Six places is 32^6 ≈ 1.07 billion, against maybe 50,000 complaints over the
 * system's whole life, so a clash is a once-ever event; submitComplaint
 * re-checks the issued tokens and retries anyway.
 *
 * There is no date prefix. It made tokens half again as long to save a lookup
 * the dashboard already does better — it shows each complaint's age directly.
 *
 * Randomness comes from Web Crypto rather than node:crypto because this
 * module is imported by /resolve and /status, which run in the browser.
 */

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const LEN = 6;

export const TOKEN_RE = /^[2-9A-HJ-NP-Z]{6}$/;

/** A fresh token. Uniqueness is enforced by the caller, not here. */
export function makeToken(): string {
  // 256 is an exact multiple of 32, so a raw byte modulo the alphabet length
  // is uniform — no rejection sampling needed.
  const bytes = new Uint8Array(LEN);
  crypto.getRandomValues(bytes);

  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/**
 * Normalises what a human typed into canonical form, or returns null.
 *
 * Forgives case, spaces and dashes — all of which happen at a doorstep. It
 * does NOT try to repair a character outside the alphabet: a typed O could
 * have been misread from several things, and guessing would quietly open
 * somebody else's complaint. Better to reject and let them look again.
 */
export function normaliseToken(input: string): string | null {
  const raw = input.trim().toUpperCase().replace(/[\s-]/g, "");
  return TOKEN_RE.test(raw) ? raw : null;
}
