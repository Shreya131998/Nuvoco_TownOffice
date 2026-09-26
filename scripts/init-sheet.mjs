/**
 * Builds the Google Sheet: creates the two register tabs plus the hidden
 * issue-type master, and fills the master.
 *
 * Safe to re-run: the master is rewritten each time, the registers are only
 * given a header when they are empty and are never cleared.
 *
 *   npm run sheet:init
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { JWT } from 'google-auth-library';

// .env.local is not loaded automatically outside Next.
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

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const KEY = process.env.GOOGLE_PRIVATE_KEY;

// Same loopback seam as the app: lets the sheet be built against the local
// stand-in (scripts/dev/fake-sheets.mjs) without Google credentials.
const OVERRIDE = process.env.GOOGLE_SHEETS_API_BASE;
const LOCAL = Boolean(OVERRIDE && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(OVERRIDE));

if (!SHEET_ID || (!LOCAL && (!EMAIL || !KEY))) {
  console.error(
    '\nMissing configuration. Set these in .env.local:\n' +
    '  GOOGLE_SHEETS_ID\n  GOOGLE_SERVICE_ACCOUNT_EMAIL\n  GOOGLE_PRIVATE_KEY\n' +
    '\nSee the README section "Google Sheets setup".\n'
  );
  process.exit(1);
}

const auth = LOCAL
  ? null
  : new JWT({
      email: EMAIL,
      key: KEY.replace(/\\n/g, '\n'),
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
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403) {
      // Both causes return 403; the body distinguishes them.
      if (/SERVICE_DISABLED|has not been used in project|is disabled/i.test(body)) {
        const proj = /project[s]?[ /]([0-9]+)/i.exec(body)?.[1] ?? '';
        throw new Error(
          'The Google Sheets API is not enabled for this service account\'s project.\n' +
          'Enable it here, wait ~1 minute, then re-run:\n  ' +
          `https://console.cloud.google.com/apis/library/sheets.googleapis.com${proj ? `?project=${proj}` : ''}`
        );
      }
      throw new Error(
        'Access denied (403). Open the spreadsheet, click Share, and add\n  ' +
        `${EMAIL}\nas an Editor. Then re-run.`
      );
    }
    if (res.status === 404) {
      throw new Error(`Spreadsheet not found (404). Check GOOGLE_SHEETS_ID.\n${body.slice(0, 200)}`);
    }
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// ---- the master list ----------------------------------------------------
// The eight categories the town office already uses, with Hindi and a target
// turnaround each. All of it is editable in the sheet afterwards: reword the
// Hindi, change an SLA or add a ninth row and the form picks it up within five
// minutes without a deploy.
const ISSUE_TYPES = [
  { en: 'CIVIL',        hi: 'सिविल कार्य',        sla: 72 },
  { en: 'PLUMBING',     hi: 'प्लंबिंग (नल-पानी)', sla: 24 },
  { en: 'CARPENTER',    hi: 'बढ़ई का काम',         sla: 72 },
  { en: 'ELECTRICAL',   hi: 'बिजली',              sla: 12 },
  { en: 'SEWERLINE',    hi: 'सीवर लाइन',          sla: 24 },
  { en: 'HOUSEKEEPING', hi: 'साफ़-सफ़ाई',          sla: 24 },
  { en: 'PEST CONTROL', hi: 'कीट नियंत्रण',        sla: 72 },
  { en: 'HORTICULTURE', hi: 'बागवानी',            sla: 120 },
];


// The township's blocks and buildings. Order is what the resident scans down,
// so the lettered quarters come first and the named places after.
//
// units: [from, to] renders a numbered dropdown for that block; null renders a
// free-text box instead. They are all null to begin with because nobody has
// written the ranges down — fill unit_from and unit_to in the sheet for a
// block and its picker tightens up on the next load, no deploy.
const BLOCKS = [
  { en: 'A',                hi: 'ए',                    units: null },
  { en: 'B',                hi: 'बी',                   units: null },
  { en: 'BC',               hi: 'बीसी',                 units: null },
  { en: 'C',                hi: 'सी',                   units: null },
  { en: 'D',                hi: 'डी',                   units: null },
  { en: 'DE',               hi: 'डीई',                  units: null },
  { en: 'E',                hi: 'ई',                    units: null },
  { en: 'F',                hi: 'एफ',                   units: null },
  { en: 'Hostel 1',         hi: 'हॉस्टल 1',             units: null },
  { en: 'Hostel 2',         hi: 'हॉस्टल 2',             units: null },
  { en: 'China Town',       hi: 'चाइना टाउन',           units: null },
  { en: 'Security Barrack', hi: 'सिक्योरिटी बैरक',      units: null },
  { en: 'Guest House',      hi: 'गेस्ट हाउस',           units: null },
  { en: 'School',           hi: 'स्कूल',                units: null },
  { en: 'NRDS',             hi: 'एनआरडीएस',             units: null },
  { en: 'Shopping Complex', hi: 'शॉपिंग कॉम्प्लेक्स',   units: null },
  { en: 'ADM',              hi: 'एडीएम',                units: null },
  { en: 'Hospital',         hi: 'अस्पताल',              units: null },
  { en: 'Temple',           hi: 'मंदिर',                units: null },
];

// Routine work on the common areas — nothing to do with a complaint, so it
// has its own list. Two to start with; add a row to _work_types for drain
// cleaning, grass cutting, a water tanker round or anything else, and it
// appears in the dropdown within five minutes.
const WORK_TYPES = [
  { en: 'Road Cleaning',      hi: 'सड़क सफाई' },
  { en: 'Garbage Collection', hi: 'कचरा संग्रहण' },
  { en: 'Horticulture',       hi: 'बागवानी' },
];

// Headers are duplicated from lib/sheets/schema.ts — this file is .mjs and
// cannot import the TS module. Keep the two in sync; a mismatch makes the
// register-header step below exit rather than corrupt a live tab.
const meta = await call('');
const byTitle = new Map(meta.sheets.map((s) => [s.properties.title, s.properties]));

/**
 * Ids already issued for a master tab, keyed by label.
 *
 * This script rewrites the master tabs in full on every run, and a fresh
 * randomUUID() per row would hand every existing record a dangling foreign
 * key — a complaint filed last week would stop matching its issue type, and
 * silently fall back to the default SLA. So an existing label keeps the id it
 * already has, and only genuinely new rows get a new one.
 */
async function existingIds(tab, labelCol = 'label_en') {
  if (!byTitle.has(tab)) return new Map();
  const cur = await call(`/values/${encodeURIComponent(`'${tab}'`)}`);
  const rows = cur.values ?? [];
  if (rows.length < 2) return new Map();
  const header = rows[0];
  const li = header.indexOf(labelCol);
  const ii = header.indexOf('id');
  if (li === -1 || ii === -1) return new Map();
  return new Map(
    rows.slice(1).filter((r) => r[li] && r[ii]).map((r) => [r[li], r[ii]])
  );
}

const keptIssueIds = await existingIds('_issue_types');
const keptBlockIds = await existingIds('_blocks');
const keptWorkIds = await existingIds('_work_types');
const reuse = (map, label) => map.get(label) ?? randomUUID();

const REFERENCE = {
  _issue_types: {
    header: ['sort_order', 'label_en', 'label_hi', 'sla_hours', 'active', 'id'],
    rows: ISSUE_TYPES.map((t, i) => [i + 1, t.en, t.hi, t.sla, 'TRUE', reuse(keptIssueIds, t.en)]),
  },
  _blocks: {
    header: ['sort_order', 'label_en', 'label_hi', 'unit_from', 'unit_to', 'active', 'id'],
    rows: BLOCKS.map((b, i) => [
      i + 1, b.en, b.hi, b.units?.[0] ?? '', b.units?.[1] ?? '', 'TRUE',
      reuse(keptBlockIds, b.en),
    ]),
  },
  _work_types: {
    header: ['sort_order', 'label_en', 'label_hi', 'active', 'id'],
    rows: WORK_TYPES.map((w, i) => [i + 1, w.en, w.hi, 'TRUE', reuse(keptWorkIds, w.en)]),
  },
};

const TRANSACTION = {
  Complaints: [
    'token', 'submitted_at', 'complaint_date', 'resident_name', 'quarter_no',
    'mobile', 'issue_type_id', 'issue_type_en', 'issue_type_hi', 'description',
    'photo_url', 'photo_public_id', 'id', 'video_url', 'video_id',
  ],
  Resolutions: [
    'token', 'resolved_at', 'resolve_date', 'technician_name',
    'technician_mobile', 'outcome', 'action_taken', 'photo_url',
    'photo_public_id', 'id', 'video_url', 'video_id',
  ],
  'Area Work': [
    'work_date', 'logged_at', 'work_type_id', 'work_type_en', 'work_type_hi',
    'area', 'worker_name', 'worker_mobile', 'notes', 'photo_url',
    'photo_public_id', 'id', 'video_url', 'video_id',
  ],
};


// Registers first, so they sit leftmost in the tab bar.
const wanted = [...Object.keys(TRANSACTION), ...Object.keys(REFERENCE)];
const requests = [];

wanted.forEach((title, index) => {
  const hidden = title.startsWith('_');
  const existing = byTitle.get(title);
  if (!existing) {
    requests.push({
      addSheet: {
        properties: { title, index, hidden, gridProperties: { frozenRowCount: 1 } },
      },
    });
  } else {
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: existing.sheetId, index, hidden,
                      gridProperties: { frozenRowCount: 1 } },
        fields: 'index,hidden,gridProperties.frozenRowCount',
      },
    });
  }
});

// Google creates a default "Sheet1" with every new spreadsheet. Remove it,
// but only when it is completely empty.
if (byTitle.has('Sheet1') && !wanted.includes('Sheet1')) {
  const cur = await call(`/values/${encodeURIComponent(`'Sheet1'`)}`);
  if (!(cur.values ?? []).length) {
    requests.push({ deleteSheet: { sheetId: byTitle.get('Sheet1').sheetId } });
  } else {
    console.log('  Sheet1 has content — left alone');
  }
}

if (requests.length) {
  await call(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) });
  const made = requests.filter((r) => r.addSheet).map((r) => r.addSheet.properties.title);
  if (made.length) console.log(`created: ${made.join(', ')}`);
}

// ---- master tab: rewrite in full ---------------------------------------
for (const [tab, { header, rows }] of Object.entries(REFERENCE)) {
  await call(`/values/${encodeURIComponent(`'${tab}'`)}:clear`, { method: 'POST' });
  await call(`/values/${encodeURIComponent(`'${tab}'`)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [header, ...rows] }),
  });
  console.log(`  ${tab.padEnd(14)} ${String(rows.length).padStart(3)} rows (hidden)`);
}

// ---- register tabs: only write headers when safe ------------------------
for (const [tab, header] of Object.entries(TRANSACTION)) {
  const cur = await call(`/values/${encodeURIComponent(`'${tab}'`)}`);
  const existing = cur.values ?? [];
  const sameShape =
    existing[0]?.length === header.length &&
    header.every((h, i) => existing[0][i] === h);

  if (existing[0]?.length && sameShape) {
    console.log(`  ${tab.padEnd(14)} already in use — left untouched`);
    continue;
  }

  // Columns added on the END are safe to apply in place: every existing row
  // simply has blanks in the new ones, and nothing is re-ordered underneath
  // the data. Only a rename or a re-order genuinely needs the tab emptied,
  // and conflating the two meant "add a column" cost you every row.
  const appendOnly =
    existing[0]?.length &&
    existing[0].length < header.length &&
    existing[0].every((h, i) => header[i] === h);

  if (appendOnly) {
    await call(`/values/${encodeURIComponent(`'${tab}'!A1`)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: [header] }),
    });
    const added = header.slice(existing[0].length);
    console.log(
      `  ${tab.padEnd(14)} +${added.length} column(s): ${added.join(', ')} ` +
      `(${Math.max(0, existing.length - 1)} row(s) kept)`
    );
    continue;
  }

  if (existing.length > 1) {
    console.error(
      `\nTab "${tab}" has columns renamed or re-ordered, and already holds ` +
      `${existing.length - 1} row(s).\nAdding columns at the end is applied ` +
      'in place; this is not that.\nDownload the rows from the admin Export ' +
      'page, run "npm run sheet:clear", then re-run this.\n'
    );
    process.exit(1);
  }
  if (existing[0]?.length) {
    await call(`/values/${encodeURIComponent(`'${tab}'`)}:clear`, { method: 'POST' });
    console.log(`  ${tab.padEnd(14)} column layout changed — header rebuilt`);
  }
  await call(`/values/${encodeURIComponent(`'${tab}'!A1`)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [header] }),
  });
  console.log(`  ${tab.padEnd(14)} ready (${header.length} columns)`);
}

console.log('\nSheet ready: https://docs.google.com/spreadsheets/d/' + SHEET_ID);
