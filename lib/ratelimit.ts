/**
 * In-memory per-IP rate limiting.
 *
 * Deliberately not durable: it lives in one server process, so a restart
 * clears it and a multi-instance deployment gets one bucket per instance.
 * That is the right trade here — the goal is to blunt a script hammering the
 * open complaint form, not to enforce a precise quota. Anything stronger
 * means a shared store, which means a bill.
 */

type Bucket = { n: number; first: number };

const buckets = new Map<string, Map<string, Bucket>>();

/** Trust the FIRST entry: on Vercel the platform appends, so it is the client. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

/**
 * Returns false when the caller is over budget. Callers respond 429.
 * `windowMs` is a fixed window, not sliding — cheaper, and close enough.
 */
export function allow(
  name: string,
  ip: string,
  max: number,
  windowMs: number
): boolean {
  let scope = buckets.get(name);
  if (!scope) {
    scope = new Map();
    buckets.set(name, scope);
  }

  const now = Date.now();
  const hit = scope.get(ip);

  if (!hit || now - hit.first > windowMs) {
    scope.set(ip, { n: 1, first: now });
    sweep(scope, now, windowMs);
    return true;
  }

  hit.n += 1;
  return hit.n <= max;
}

export function reset(name: string, ip: string): void {
  buckets.get(name)?.delete(ip);
}

/** Drop expired entries so a long-lived process does not grow unbounded. */
function sweep(scope: Map<string, Bucket>, now: number, windowMs: number): void {
  if (scope.size < 500) return;
  for (const [ip, b] of scope) {
    if (now - b.first > windowMs) scope.delete(ip);
  }
}
