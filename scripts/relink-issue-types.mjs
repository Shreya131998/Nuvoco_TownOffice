/**
 * Repairs complaints whose issue_type_id no longer matches any row in
 * _issue_types.
 *
 * Early versions of init-sheet.mjs generated a fresh id for every master row
 * on every run, so re-running it left existing complaints pointing at ids
 * that no longer existed. Nothing looked broken — the type name is stored on
 * the complaint row itself, so it still displays — but the SLA lookup missed
 * and those complaints quietly fell back to the 48-hour default, making the
 * overdue flag wrong.
 *
 * init-sheet.mjs now preserves ids, so this should be needed once and never
 * again. It matches on the issue_type_en already stored on each row, is safe
 * to re-run, and writes nothing when there is nothing to fix.
 *
 *   node scripts/relink-issue-types.mjs            # report only
 *   node scripts/relink-issue-types.mjs --write    # apply
 */
import { readFileSync } from 'node:fs';
import { JWT } from 'google-auth-library';

for (const file of ['.env.local', '.env']) {
  try {
    readFileSync(file, 'utf8').split('\n').forEach((line) => {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) return;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    });
  } catch { /* file may not exist */ }
}

const WRITE = process.argv.includes('--write');
const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const OVERRIDE = process.env.GOOGLE_SHEETS_API_BASE;
const LOCAL = Boolean(OVERRIDE && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(OVERRIDE));

if (!SHEET_ID) {
  console.error('GOOGLE_SHEETS_ID is not set.');
  process.exit(1);
}

const auth = LOCAL ? null : new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const API = `${LOCAL ? OVERRIDE : 'https://sheets.googleapis.com/v4/spreadsheets'}/${SHEET_ID}`;

async function call(path, init) {
  const token = LOCAL ? 'local-stub' : (await auth.getAccessToken()).token;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const values = async (tab) =>
  (await call(`/values/${encodeURIComponent(`'${tab}'`)}`)).values ?? [];

const types = await values('_issue_types');
const complaints = await values('Complaints');

if (complaints.length < 2) {
  console.log('No complaints to check.');
  process.exit(0);
}

const th = types[0];
const byLabel = new Map(
  types.slice(1).map((r) => [r[th.indexOf('label_en')], r[th.indexOf('id')]])
);
const liveIds = new Set(byLabel.values());

const ch = complaints[0];
const idCol = ch.indexOf('issue_type_id');
const enCol = ch.indexOf('issue_type_en');
const tokenCol = ch.indexOf('token');

let fixed = 0;
let unfixable = 0;
const rows = complaints.slice(1).map((r) => [...r]);

for (const r of rows) {
  const current = r[idCol];
  if (liveIds.has(current)) continue;

  const correct = byLabel.get(r[enCol]);
  if (!correct) {
    // The type was renamed or retired since. Leave it: guessing which of the
    // current types it became would be worse than a missing link.
    console.log(`  ${r[tokenCol]}  ${r[enCol]} — no matching type, left alone`);
    unfixable += 1;
    continue;
  }
  console.log(`  ${r[tokenCol]}  ${r[enCol]} — relinked`);
  r[idCol] = correct;
  fixed += 1;
}

if (fixed === 0) {
  console.log(`\nNothing to repair.${unfixable ? ` ${unfixable} row(s) could not be matched.` : ''}`);
  process.exit(0);
}

if (!WRITE) {
  console.log(`\n${fixed} row(s) would be relinked. Re-run with --write to apply.`);
  process.exit(0);
}

// One full rewrite of the data rows, header untouched. Safe here in a way it
// would not be in the app: this is a manual, one-off repair, not something
// racing a resident hitting submit.
await call(`/values/${encodeURIComponent(`'Complaints'!A2`)}?valueInputOption=RAW`, {
  method: 'PUT',
  body: JSON.stringify({ values: rows }),
});

console.log(`\n${fixed} row(s) relinked.`);
