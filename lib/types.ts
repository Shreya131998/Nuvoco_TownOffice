/** Domain types for the resident complaint portal. */

/** One row of the hidden _issue_types master tab. */
export type IssueType = {
  id: string;
  sort_order: number;
  label_en: string;
  label_hi: string;
  /** Hours from submission before an unresolved complaint counts as overdue. */
  sla_hours: number;
};

/**
 * One row of the hidden _blocks master tab — a block or building in the
 * township, as offered in the quarter picker.
 */
export type Block = {
  id: string;
  sort_order: number;
  label_en: string;
  label_hi: string;
  /** Both set = the picker offers this numbered range. Null = free text. */
  unit_from: number | null;
  unit_to: number | null;
};

/**
 * A quarter is stored as one string, exactly as the township writes it:
 * "B-11" for a numbered quarter, "Temple" for a place that has no units.
 * Splitting it into two columns would mean migrating every existing row and
 * would gain nothing — nothing queries the block on its own.
 */
export function formatQuarter(block: string, unit: string): string {
  const b = block.trim();
  const u = unit.trim();
  return u ? `${b}-${u}` : b;
}

/** One row of the hidden _work_types master — a kind of common-area round. */
export type WorkType = {
  id: string;
  sort_order: number;
  label_en: string;
  label_hi: string;
};

/**
 * A round of work on the common areas: sweeping, a garbage collection run.
 *
 * Carries no token and no quarter. It is not a complaint being answered, so
 * it has no status either — the work either happened on a date or it did not.
 */
export type AreaWork = {
  id: string;
  work_date: string;
  logged_at: string;
  work_type_id: string;
  work_type_en: string;
  work_type_hi: string;
  /** Free text: "main road", "behind D block". Deliberately not a quarter. */
  area: string | null;
  worker_name: string;
  worker_mobile: string | null;
  notes: string;
  photo_url: string | null;
};

/** What a technician recorded on a visit. */
export type Outcome = "resolved" | "partial" | "not_possible";

export const OUTCOME_META: Record<
  Outcome,
  { en: string; hi: string; tone: Tone }
> = {
  resolved: { en: "Fixed", hi: "ठीक हो गया", tone: "ok" },
  partial: { en: "Partly done — will return", hi: "आंशिक — दोबारा आना है", tone: "warn" },
  not_possible: { en: "Could not fix", hi: "ठीक नहीं हो सका", tone: "danger" },
};

/**
 * Derived, never stored. A complaint saved as "open" in March is wrong by
 * April; the status is recomputed from the resolution rows on every read.
 */
export type ComplaintStatus = "open" | "in_progress" | "resolved" | "blocked";

export type Tone = "ok" | "warn" | "danger" | "info" | "muted" | "primary";

export const STATUS_META: Record<
  ComplaintStatus,
  { en: string; hi: string; tone: Tone }
> = {
  open: { en: "Open", hi: "लंबित", tone: "warn" },
  in_progress: { en: "In progress", hi: "कार्य जारी", tone: "info" },
  resolved: { en: "Resolved", hi: "हल हो गया", tone: "ok" },
  blocked: { en: "Needs attention", hi: "ध्यान देने योग्य", tone: "danger" },
};

/** One row of the Resolutions tab. */
export type Resolution = {
  id: string;
  token: string;
  resolved_at: string;
  resolve_date: string;
  technician_name: string;
  technician_mobile: string | null;
  outcome: Outcome;
  action_taken: string;
  photo_url: string | null;
};

/** A complaint joined to its latest resolution, with status derived. */
export type Complaint = {
  id: string;
  token: string;
  submitted_at: string;
  complaint_date: string;
  resident_name: string;
  quarter_no: string;
  mobile: string;
  issue_type_id: string;
  issue_type_en: string;
  issue_type_hi: string;
  description: string;
  photo_url: string | null;

  /** Derived below this line. */
  status: ComplaintStatus;
  /** Every visit, oldest first — the audit trail of repeat call-outs. */
  visits: Resolution[];
  /** The visit that decided the current status, or null while still open. */
  latest: Resolution | null;
  /** Whole hours from submission to resolution; null while unresolved. */
  resolution_hours: number | null;
  /** Whole hours since submission. Keeps counting after resolution. */
  age_hours: number;
  /** Unresolved and past this issue type's SLA. */
  overdue: boolean;
};

export type ActivityKind = "raised" | "resolved" | "area";

/**
 * One entry in the dashboard feed: a complaint filed, a visit recorded, or a
 * round of common-area work.
 *
 * `token` and `quarter_no` are empty strings for area work, which has
 * neither. The feed renders them conditionally rather than pretending.
 */
export type Activity = {
  kind: ActivityKind;
  token: string;
  at: string;
  on_date: string;
  person: string;
  issue_type_en: string;
  issue_type_hi: string;
  quarter_no: string;
  detail: string | null;
};
