import "server-only";
import { randomUUID } from "node:crypto";
import { appendRows, readTabs, toObjects, isSheetsConfigured } from "./client";
import {
  TAB,
  COMPLAINT_COLS,
  RESOLUTION_COLS,
  DEFAULT_SLA_HOURS,
} from "./schema";
import { BadRequest, NotFound } from "@/lib/api";
import { makeToken } from "@/lib/token";
import { istToday, istDate } from "@/lib/dates";
import type {
  Activity,
  Block,
  Complaint,
  ComplaintStatus,
  IssueType,
  Outcome,
  Resolution,
} from "@/lib/types";

/**
 * The whole data layer.
 *
 * Everything is computed from two append-only register tabs plus one master.
 * No status, age or count is ever written down — a complaint stored as "open"
 * in March is wrong by April.
 */

// ── caching ──────────────────────────────────────────────────────────────
// Sheets allows ~60 reads/minute/user and one dashboard load touches every
// tab, so each is fetched once per batch and held briefly. Reference data
// barely changes; registers are cleared the instant anything is written, so a
// resident never submits and then fails to see their own complaint.

type Grid = Record<string, string[][]>;

const REF_TTL = 5 * 60_000;
const TX_TTL = 10_000;

let refCache: { at: number; data: Grid } | null = null;
let txCache: { at: number; data: Grid } | null = null;

async function reference(force = false): Promise<Grid> {
  if (!force && refCache && Date.now() - refCache.at < REF_TTL) return refCache.data;
  const data = await readTabs([TAB.issueType, TAB.block]);
  refCache = { at: Date.now(), data };
  return data;
}

async function transactions(force = false): Promise<Grid> {
  if (!force && txCache && Date.now() - txCache.at < TX_TTL) return txCache.data;
  const data = await readTabs([TAB.complaints, TAB.resolutions]);
  txCache = { at: Date.now(), data };
  return data;
}

function invalidateTransactions(): void {
  txCache = null;
}

export function isConfigured(): boolean {
  return isSheetsConfigured();
}

// ── reference ────────────────────────────────────────────────────────────

/** Blank means active, so a hand-added master row works without editing it. */
const truthy = (v: string | undefined) =>
  v === undefined || v === "" || /^(true|yes|1)$/i.test(v);

export async function getIssueTypes(): Promise<IssueType[]> {
  const g = await reference();
  return toObjects(g[TAB.issueType] ?? [])
    .filter((r) => truthy(r.active))
    .map((r) => ({
      id: r.id,
      sort_order: Number(r.sort_order) || 0,
      label_en: r.label_en,
      label_hi: r.label_hi || r.label_en,
      sla_hours: Number(r.sla_hours) || DEFAULT_SLA_HOURS,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function getBlocks(): Promise<Block[]> {
  const g = await reference();
  return toObjects(g[TAB.block] ?? [])
    .filter((r) => truthy(r.active))
    .map((r) => ({
      id: r.id,
      sort_order: Number(r.sort_order) || 0,
      label_en: r.label_en,
      label_hi: r.label_hi || r.label_en,
      // Both or neither. A half-filled range would render a dropdown that
      // cannot express the other half of the block.
      unit_from:
        r.unit_from && r.unit_to ? Number(r.unit_from) || null : null,
      unit_to: r.unit_from && r.unit_to ? Number(r.unit_to) || null : null,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export type LoadResult =
  | { ok: true; issueTypes: IssueType[]; blocks: Block[] }
  | { ok: false; detail?: string };

/**
 * Flattens the three ways loading can fail — unconfigured, API error, empty
 * master — into one value, so every page handles them identically.
 */
export async function loadReference(): Promise<LoadResult> {
  if (!isSheetsConfigured()) return { ok: false };
  try {
    const [issueTypes, blocks] = await Promise.all([getIssueTypes(), getBlocks()]);
    if (issueTypes.length === 0 || blocks.length === 0) {
      return {
        ok: false,
        detail: "Issue types or blocks are missing. Run `npm run sheet:init`.",
      };
    }
    return { ok: true, issueTypes, blocks };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

// ── writing ──────────────────────────────────────────────────────────────

export type ComplaintInput = {
  resident_name: string;
  quarter_no: string;
  mobile: string;
  issue_type_id: string;
  description: string;
  photo_url: string | null;
  photo_public_id: string | null;
};

/**
 * Appends one complaint and returns its token.
 *
 * Collision handling is best-effort, not a guarantee: Sheets has no unique
 * constraint, so two requests landing in the same millisecond could in
 * principle both pass the check and both append. At 32^4 combinations per day
 * against ~20 complaints that is vanishingly unlikely, and the duplicate would
 * be visible in the sheet rather than silent.
 */
export async function submitComplaint(
  input: ComplaintInput
): Promise<{ token: string }> {
  const types = await getIssueTypes();
  const type = types.find((t) => t.id === input.issue_type_id);
  if (!type) {
    throw new BadRequest("That issue type no longer exists. Reload the form.");
  }

  const today = istToday();
  const taken = new Set((await rawComplaints()).map((c) => c.token));

  let token = makeToken();
  for (let i = 0; i < 5 && taken.has(token); i++) token = makeToken();
  if (taken.has(token)) {
    throw new Error("Could not allocate a unique token after 5 attempts");
  }

  const now = new Date().toISOString();
  const row: Record<(typeof COMPLAINT_COLS)[number], string> = {
    token,
    submitted_at: now,
    complaint_date: today,
    resident_name: input.resident_name,
    quarter_no: input.quarter_no,
    mobile: input.mobile,
    issue_type_id: type.id,
    issue_type_en: type.label_en,
    issue_type_hi: type.label_hi,
    description: input.description,
    photo_url: input.photo_url ?? "",
    photo_public_id: input.photo_public_id ?? "",
    id: randomUUID(),
  };

  await appendRows(TAB.complaints, [COMPLAINT_COLS.map((c) => row[c])]);
  invalidateTransactions();
  return { token };
}

export type ResolutionInput = {
  token: string;
  technician_name: string;
  technician_mobile: string | null;
  outcome: Outcome;
  action_taken: string;
  photo_url: string | null;
  photo_public_id: string | null;
};

/** Appends a visit. The complaint row itself is never touched. */
export async function submitResolution(
  input: ResolutionInput
): Promise<{ token: string }> {
  const exists = (await rawComplaints()).some((c) => c.token === input.token);
  if (!exists) {
    throw new NotFound("We have no complaint with that token. Please check and try again.");
  }

  const now = new Date().toISOString();
  const row: Record<(typeof RESOLUTION_COLS)[number], string> = {
    token: input.token,
    resolved_at: now,
    resolve_date: istDate(now),
    technician_name: input.technician_name,
    technician_mobile: input.technician_mobile ?? "",
    outcome: input.outcome,
    action_taken: input.action_taken,
    photo_url: input.photo_url ?? "",
    photo_public_id: input.photo_public_id ?? "",
    id: randomUUID(),
  };

  await appendRows(TAB.resolutions, [RESOLUTION_COLS.map((c) => row[c])]);
  invalidateTransactions();
  return { token: input.token };
}

// ── reading ──────────────────────────────────────────────────────────────

type RawComplaint = Omit<
  Complaint,
  "status" | "visits" | "latest" | "resolution_hours" | "age_hours" | "overdue"
>;

async function rawComplaints(): Promise<RawComplaint[]> {
  const grid = (await transactions())[TAB.complaints] ?? [];
  return toObjects(grid)
    .filter((r) => r.token)
    .map((r) => ({
      id: r.id,
      token: r.token,
      submitted_at: r.submitted_at,
      complaint_date: r.complaint_date,
      resident_name: r.resident_name,
      quarter_no: r.quarter_no,
      mobile: r.mobile,
      issue_type_id: r.issue_type_id,
      issue_type_en: r.issue_type_en,
      issue_type_hi: r.issue_type_hi,
      description: r.description,
      photo_url: r.photo_url || null,
    }));
}

async function rawResolutions(): Promise<Resolution[]> {
  const grid = (await transactions())[TAB.resolutions] ?? [];
  return toObjects(grid)
    .filter((r) => r.token)
    .map((r) => ({
      id: r.id,
      token: r.token,
      resolved_at: r.resolved_at,
      resolve_date: r.resolve_date,
      technician_name: r.technician_name,
      technician_mobile: r.technician_mobile || null,
      outcome: (r.outcome as Outcome) || "resolved",
      action_taken: r.action_taken,
      photo_url: r.photo_url || null,
    }));
}

const STATUS_FOR: Record<Outcome, ComplaintStatus> = {
  resolved: "resolved",
  partial: "in_progress",
  not_possible: "blocked",
};

const hoursBetween = (from: string, to: string) =>
  Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 3_600_000));

/**
 * Every complaint, joined to its visits, newest first.
 *
 * Status comes from the LAST visit by timestamp — the substitute for a unique
 * index. A technician who returns to finish a partial job appends a second row
 * and the complaint flips to resolved; both rows stay as the audit trail.
 */
export async function getComplaints(): Promise<Complaint[]> {
  const [complaints, resolutions, types] = await Promise.all([
    rawComplaints(),
    rawResolutions(),
    getIssueTypes(),
  ]);

  const sla = new Map(types.map((t) => [t.id, t.sla_hours]));

  const byToken = new Map<string, Resolution[]>();
  for (const r of resolutions) {
    const list = byToken.get(r.token);
    if (list) list.push(r);
    else byToken.set(r.token, [r]);
  }
  for (const list of byToken.values()) {
    list.sort((a, b) => (a.resolved_at < b.resolved_at ? -1 : 1));
  }

  const now = new Date().toISOString();

  return complaints
    .map((c) => {
      const visits = byToken.get(c.token) ?? [];
      const latest = visits.length ? visits[visits.length - 1] : null;
      const status: ComplaintStatus = latest ? STATUS_FOR[latest.outcome] : "open";
      const settled = status === "resolved";

      return {
        ...c,
        visits,
        latest,
        status,
        resolution_hours: settled && latest
          ? hoursBetween(c.submitted_at, latest.resolved_at)
          : null,
        age_hours: hoursBetween(c.submitted_at, now),
        overdue:
          !settled &&
          hoursBetween(c.submitted_at, now) >
            (sla.get(c.issue_type_id) ?? DEFAULT_SLA_HOURS),
      };
    })
    .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
}

export async function getByToken(token: string): Promise<Complaint | null> {
  const all = await getComplaints();
  return all.find((c) => c.token === token) ?? null;
}

/**
 * Every complaint for one quarter, newest first.
 *
 * This is now the only way in besides the token, for both the resident who
 * lost their slip and the technician at the door. Asking for a name or a
 * mobile number on top was accurate but unusable: names are typed freehand so
 * spellings never matched, and a technician standing at B-11 has no reason to
 * know the resident's phone number.
 *
 * The cost is real and worth stating plainly: anyone who can pick a quarter
 * can read that quarter's complaints and, on /resolve, close them. For a
 * township help desk that is an acceptable trade — every resolution records
 * who filed it and the resident sees the whole history — but it is a trade,
 * not a free win. STAFF_ACCESS_CODE gates /resolve if it stops being one.
 */
export async function getByQuarter(quarter: string): Promise<Complaint[]> {
  const q = quarter.trim().toUpperCase();
  if (!q) return [];
  const all = await getComplaints();
  return all.filter((c) => c.quarter_no.trim().toUpperCase() === q);
}

/**
 * The unresolved complaints at one quarter — what the technician picks from
 * after they have done the work. Oldest first: if two are open, the one that
 * has been waiting longest is the likelier answer.
 */
export async function getOpenByQuarter(quarter: string): Promise<Complaint[]> {
  return (await getByQuarter(quarter))
    .filter((c) => c.status !== "resolved")
    .sort((a, b) => (a.submitted_at < b.submitted_at ? -1 : 1));
}

// ── dashboard aggregations ───────────────────────────────────────────────

const inRange = (d: string, r: { from: string; to: string }) =>
  d >= r.from && d <= r.to;

export type Summary = {
  raisedToday: number;
  resolvedToday: number;
  openNow: number;
  overdue: number;
  raisedInRange: number;
  resolvedInRange: number;
  avgResolutionHours: number | null;
};

export async function getSummary(range: {
  from: string;
  to: string;
}): Promise<Summary> {
  const all = await getComplaints();
  const today = istToday();

  // Resolution counts key off the visit date, not the complaint date: a
  // complaint filed last week and fixed this morning is resolved TODAY.
  const settledInRange = all.filter(
    (c) => c.status === "resolved" && c.latest && inRange(c.latest.resolve_date, range)
  );

  const done = settledInRange
    .map((c) => c.resolution_hours)
    .filter((h): h is number => h !== null);

  return {
    raisedToday: all.filter((c) => c.complaint_date === today).length,
    resolvedToday: all.filter(
      (c) => c.status === "resolved" && c.latest?.resolve_date === today
    ).length,
    openNow: all.filter((c) => c.status !== "resolved").length,
    overdue: all.filter((c) => c.overdue).length,
    raisedInRange: all.filter((c) => inRange(c.complaint_date, range)).length,
    resolvedInRange: settledInRange.length,
    avgResolutionHours: done.length
      ? Math.round(done.reduce((a, b) => a + b, 0) / done.length)
      : null,
  };
}

export type DayCount = { day: string; raised: number; resolved: number };

/** One row per day in the window, zeros included, so the chart has no gaps. */
export async function getDailyCounts(range: {
  from: string;
  to: string;
}): Promise<DayCount[]> {
  const all = await getComplaints();
  const days = new Map<string, DayCount>();

  for (let d = range.from; d <= range.to; ) {
    days.set(d, { day: d, raised: 0, resolved: 0 });
    const next = new Date(d + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    d = next.toISOString().slice(0, 10);
  }

  for (const c of all) {
    const slot = days.get(c.complaint_date);
    if (slot) slot.raised += 1;
    if (c.status === "resolved" && c.latest) {
      const r = days.get(c.latest.resolve_date);
      if (r) r.resolved += 1;
    }
  }

  return [...days.values()];
}

export type Ranked = { label: string; value: number; sub?: string };

export async function getByIssueType(range: {
  from: string;
  to: string;
}): Promise<Ranked[]> {
  const all = (await getComplaints()).filter((c) =>
    inRange(c.complaint_date, range)
  );
  const counts = new Map<string, { n: number; hi: string }>();

  for (const c of all) {
    const hit = counts.get(c.issue_type_en);
    if (hit) hit.n += 1;
    else counts.set(c.issue_type_en, { n: 1, hi: c.issue_type_hi });
  }

  return [...counts.entries()]
    .map(([label, v]) => ({ label, value: v.n, sub: v.hi }))
    .sort((a, b) => b.value - a.value);
}

/** Which buildings complain most — surfaces a chronically bad quarter. */
export async function getQuarterCounts(range: {
  from: string;
  to: string;
}): Promise<Ranked[]> {
  const all = (await getComplaints()).filter((c) =>
    inRange(c.complaint_date, range)
  );
  const counts = new Map<string, number>();
  for (const c of all) {
    const key = c.quarter_no.toUpperCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/** Average hours to fix, by trade — shows which one is slow. */
export async function getSpeedByIssueType(range: {
  from: string;
  to: string;
}): Promise<Ranked[]> {
  const all = (await getComplaints()).filter(
    (c) => c.status === "resolved" && c.latest && inRange(c.latest.resolve_date, range)
  );
  const acc = new Map<string, { total: number; n: number }>();

  for (const c of all) {
    if (c.resolution_hours === null) continue;
    const hit = acc.get(c.issue_type_en) ?? { total: 0, n: 0 };
    hit.total += c.resolution_hours;
    hit.n += 1;
    acc.set(c.issue_type_en, hit);
  }

  return [...acc.entries()]
    .map(([label, v]) => ({
      label,
      value: Math.round(v.total / v.n),
      sub: `${v.n} resolved`,
    }))
    .sort((a, b) => b.value - a.value);
}

/** Oldest first — the queue a supervisor should work down. */
export async function getOpenComplaints(): Promise<Complaint[]> {
  const all = await getComplaints();
  return all
    .filter((c) => c.status !== "resolved")
    .sort((a, b) => (a.submitted_at < b.submitted_at ? -1 : 1));
}

export async function getActivity(range: {
  from: string;
  to: string;
}): Promise<Activity[]> {
  const all = await getComplaints();
  const out: Activity[] = [];

  for (const c of all) {
    if (inRange(c.complaint_date, range)) {
      out.push({
        kind: "raised",
        token: c.token,
        at: c.submitted_at,
        on_date: c.complaint_date,
        person: c.resident_name,
        issue_type_en: c.issue_type_en,
        issue_type_hi: c.issue_type_hi,
        quarter_no: c.quarter_no,
        detail: c.description,
      });
    }
    for (const v of c.visits) {
      if (!inRange(v.resolve_date, range)) continue;
      out.push({
        kind: "resolved",
        token: c.token,
        at: v.resolved_at,
        on_date: v.resolve_date,
        person: v.technician_name,
        issue_type_en: c.issue_type_en,
        issue_type_hi: c.issue_type_hi,
        quarter_no: c.quarter_no,
        detail: v.action_taken,
      });
    }
  }

  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

/** Groups people case-insensitively; spelling is left alone. */
export function summarisePeople(rows: Activity[]) {
  const acc = new Map<string, { name: string; count: number; last: string }>();
  for (const r of rows) {
    const key = r.person.trim().toUpperCase();
    if (!key) continue;
    const hit = acc.get(key);
    if (hit) {
      hit.count += 1;
      if (r.at > hit.last) hit.last = r.at;
    } else {
      acc.set(key, { name: r.person.trim(), count: 1, last: r.at });
    }
  }
  return [...acc.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
}
