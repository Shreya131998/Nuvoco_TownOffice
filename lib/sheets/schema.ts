/**
 * The shape of the spreadsheet.
 *
 * Conventions carried over from the OHC project, because the same people
 * maintain both sheets by hand:
 *   - visible registers are Title Case with spaces; master tabs start with "_"
 *     and are hidden (init-sheet.mjs hides purely on that prefix)
 *   - `id` is always the LAST column of a master tab
 *   - a blank `active` cell means active, so a hand-added row works untouched
 *
 * These headers are duplicated in scripts/init-sheet.mjs, which cannot import
 * a .ts module. Change one, change the other — init-sheet refuses to rewrite a
 * register whose header no longer matches, so a mismatch fails loudly.
 */

export const TAB = {
  complaints: "Complaints",
  resolutions: "Resolutions",
  areaWork: "Area Work",
  // hidden masters
  issueType: "_issue_types",
  block: "_blocks",
  workType: "_work_types",
} as const;

export const VISIBLE_TABS: string[] = [
  TAB.complaints,
  TAB.resolutions,
  TAB.areaWork,
];
export const HIDDEN_TABS: string[] = [TAB.issueType, TAB.block, TAB.workType];

/** Registers emptied by `npm run sheet:clear`. Masters are never cleared. */
export const REGISTER_TABS: string[] = [
  TAB.complaints,
  TAB.resolutions,
  TAB.areaWork,
];

/**
 * Media columns, shared by all three registers.
 *
 * `photo_url` now holds a NEWLINE-SEPARATED list, because a complaint usually
 * needs more than one angle. The singular name is kept deliberately: renaming
 * it would re-order the header, which costs every row already in the tab,
 * and a single URL parses as a one-item list either way. A Sheets cell takes
 * 50,000 characters — several hundred URLs — so the cap that matters is the
 * one the form enforces, not the sheet's.
 *
 * Video is a separate, single column rather than another entry in that list.
 * It is the one piece of media with a real cost: an image is ~180 KB after
 * the browser shrinks it, a clip is tens of megabytes and cannot be shrunk
 * client-side. Keeping it in its own column makes "does this complaint have a
 * video" answerable at a glance in the sheet, and caps it at one by shape
 * rather than by rule.
 */
export const COMPLAINT_COLS = [
  "token",
  "submitted_at",
  "complaint_date",
  "resident_name",
  "quarter_no",
  "mobile",
  "issue_type_id",
  "issue_type_en",
  "issue_type_hi",
  "description",
  "photo_url",
  "photo_public_id",
  "id",
  "video_url",
  "video_id",
] as const;

export const RESOLUTION_COLS = [
  "token",
  "resolved_at",
  "resolve_date",
  "technician_name",
  "technician_mobile",
  "outcome",
  "action_taken",
  "photo_url",
  "photo_public_id",
  "id",
  "video_url",
  "video_id",
] as const;

/**
 * The township's blocks and buildings, as they appear in the quarter picker.
 *
 * `unit_from`/`unit_to` are optional. Fill both and the form offers a numbered
 * dropdown for that block; leave them blank and it offers a free-text box, so
 * a block whose numbering nobody has written down still works today. A place
 * with no units at all — the temple, the school — just gets left blank and the
 * resident picks the block alone.
 */
export const BLOCK_COLS = [
  "sort_order",
  "label_en",
  "label_hi",
  "unit_from",
  "unit_to",
  "active",
  "id",
] as const;

/**
 * Routine work on the common areas — road sweeping, garbage rounds.
 *
 * A separate register from Resolutions, not a variant of it, because it
 * answers to nothing: there is no complaint, no token and no quarter. Forcing
 * it into the complaint tables would have meant a resolution row pointing at a
 * token that does not exist, and every join and count downstream having to
 * special-case it.
 *
 * `area` is optional and free of the quarter list: a sweeping round covers a
 * stretch of road, not a house.
 */
export const AREA_WORK_COLS = [
  "work_date",
  "logged_at",
  "work_type_id",
  "work_type_en",
  "work_type_hi",
  "area",
  "worker_name",
  "worker_mobile",
  "notes",
  "photo_url",
  "photo_public_id",
  "id",
  "video_url",
  "video_id",
] as const;

export const WORK_TYPE_COLS = [
  "sort_order",
  "label_en",
  "label_hi",
  "active",
  "id",
] as const;

export const ISSUE_TYPE_COLS = [
  "sort_order",
  "label_en",
  "label_hi",
  "sla_hours",
  "active",
  "id",
] as const;

export const HEADERS: Record<string, readonly string[]> = {
  [TAB.complaints]: COMPLAINT_COLS,
  [TAB.resolutions]: RESOLUTION_COLS,
  [TAB.issueType]: ISSUE_TYPE_COLS,
  [TAB.block]: BLOCK_COLS,
  [TAB.workType]: WORK_TYPE_COLS,
  [TAB.areaWork]: AREA_WORK_COLS,
};

/** Hours before an unresolved complaint is flagged, when the master is blank. */
export const DEFAULT_SLA_HOURS = 48;
