# Nuvoco Sonadih Town Office — Resident Complaint Portal

A resident reports a maintenance problem, gets a token, and shows that token
to whoever comes to fix it. The technician closes the complaint with the same
token, and the dashboard moves.

| Who | Page | Login |
|---|---|---|
| Resident | `/complaint` — file it, `/complaint/<token>` — track it | none |
| Maintenance staff | `/resolve` — close it, by token or by address | none |
| Town office | `/admin` — dashboard, table, Excel export | one shared password |

Every label carries Hindi alongside English. Running cost: **₹0/month**.

---

## How it fits together

```
Resident fills /complaint
        │
        ▼
   token 7K3M9P   ← appended to the "Complaints" tab
        │
        │  resident shows the token at the door
        ▼
Technician fills /resolve
        │
        ▼
   a NEW row on the "Resolutions" tab, joined by token
        │
        ▼
   /admin recomputes: raised, resolved, open, overdue
```

Nothing is ever updated in place. A complaint's status is worked out on read
from its resolution rows — see *Design decisions* below.

---

## Setup

### 1. The spreadsheet

Create a blank Google Sheet. From its URL, copy the id:

```
https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
```

### 2. The service account

The app writes as a robot account, not as you.

**If you already run the OHC checklist project**, reuse its service account —
share this new spreadsheet with the same `client_email` as **Editor** and copy
the same `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` across. There
is nothing else to do.

Otherwise, from scratch:

1. <https://console.cloud.google.com/> → create a project (any name).
2. **APIs & Services → Library** → enable **Google Sheets API**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   No roles needed.
4. Open it → **Keys → Add key → Create new key → JSON**. The file that
   downloads contains `client_email` and `private_key`.
5. **Share the spreadsheet** with that `client_email`, as **Editor**.
   Skipping this step is what causes a 403.

### 3. Photos (optional)

Create a free [Cloudinary](https://cloudinary.com) account and copy **Cloud
name**, **API Key** and **API Secret** from its dashboard.

Leave these blank and the photo field renders disabled, saying it needs
setting up. Everything else still works.

Why Cloudinary rather than storing images ourselves: a Google Sheets cell tops
out at 50,000 characters, which is about a 35 KB image, and a serverless
request body on Vercel tops out at 4.5 MB. Cloudinary's free tier holds roughly
25 GB, and the browser uploads to it **directly** — no image ever passes
through this server, so nothing is metered.

### 4. Configure

```bash
cp .env.example .env.local
```

| Variable | Value |
|---|---|
| `GOOGLE_SHEETS_ID` | the id from step 1 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON |
| `GOOGLE_PRIVATE_KEY` | `private_key` — one line, `\n` escapes intact, in double quotes |
| `CLOUDINARY_*` | from step 3, or leave blank |
| `ADMIN_PASSWORD` | the town office dashboard password, **in double quotes** |
| `AUTH_SECRET` | any random 16+ character string |
| `STAFF_ACCESS_CODE` | optional, see *Who can close a complaint* |

> **Gotcha that will cost you an hour:** in a `.env` file, `#` starts a
> comment. `ADMIN_PASSWORD=Secret#2026` silently becomes `Secret`. Quote it.

### 5. Build the tabs

```bash
npm run sheet:init
```

Creates `Complaints` and `Resolutions` plus the hidden `_issue_types` master,
seeded with the eight categories. Safe to re-run: the master is rewritten, the
registers are never cleared.

To wipe test complaints before go-live (headers and master kept):

```bash
npm run sheet:clear
```

### 6. Run

```bash
npm install && npm run dev
```

Opens on port **3001**, so it can run alongside the OHC project.

---

## How the sheet is laid out

**Two visible tabs.** Both are running logs — one row appended at the bottom,
never edited.

| Tab | One row = | Columns |
|---|---|---|
| **Complaints** | one complaint | token, who, where, what, photo |
| **Resolutions** | one *visit* | token, technician, outcome, work done, photo |

A complaint with three call-outs has one row in `Complaints` and three in
`Resolutions`. The latest visit decides the status; all three stay as the
audit trail.

**Two hidden tabs**, both editable by hand. Right-click any tab → **Unhide**.
Changes appear within five minutes, with no deploy.

`_issue_types` — the dropdown of problems:

| Column | Meaning |
|---|---|
| `sort_order` | position in the dropdown |
| `label_en` / `label_hi` | what the resident sees, both shown together |
| `sla_hours` | how long before the dashboard flags it as overdue |
| `active` | blank or `TRUE` to show it; `FALSE` to retire it |
| `id` | leave alone — existing complaints point at it |

Retire a category by setting `active` to `FALSE` rather than deleting the row.
Deleting it orphans every complaint that used it.

`_blocks` — the dropdown of addresses:

| Column | Meaning |
|---|---|
| `sort_order` | position in the dropdown |
| `label_en` / `label_hi` | the block or building, both shown together |
| `unit_from` / `unit_to` | fill **both** and that block gets a numbered dropdown; leave both blank for a free-text box |
| `active` | blank or `TRUE` to show it; `FALSE` to retire it |
| `id` | leave alone |

They ship with the ranges blank, so every block takes a typed number today.
Fill `unit_from` and `unit_to` for a block — say `1` and `48` for B — and its
picker tightens to a list on the next load. A place with no units, like the
temple, needs nothing filled in at all.

### Editing the sheet by hand

- Adding rows at the bottom of a register is always safe.
- Do **not** rename or reorder columns. They are matched by header name.
- Do **not** edit a `token` — it is the only thing joining the two tabs.

---

## Design decisions worth knowing

**Writes are append-only.** Updating a row means read-then-write on a row
index, which races when a resident and a technician submit at the same moment.
Appending never races. A resolution is therefore a new row joined on the token,
and a repeat visit is just another row — which is also how the work history
gets its audit trail for free.

**Status is computed, never stored.** A complaint saved as "open" in March is
wrong by April. `open` / `in progress` / `resolved` / `blocked` come from the
latest resolution row every time the page loads, and "overdue" is recomputed
against the issue type's current `sla_hours`.

**Dates are IST, never UTC.** A complaint filed at 01:00 IST falls on the
*previous* UTC day; dating it wrong would put it in yesterday's count.
Everything goes through `lib/dates.ts`.

**The token is six characters and nothing else.** `7K3M9P`. A resident reads
it off a cracked phone screen and a technician types it back in one-handed at
the door, so length is the enemy. The alphabet drops the four characters that
get confused in handwriting — the digits `0` and `1`, and the letters `I` and
`O` — leaving exactly 32, which over six places is 1.07 billion. (`L` stays:
with no digit `1` in the set there is nothing for it to be confused with, and
31 characters would reintroduce modulo bias in the generator.) `/resolve` and `/status` accept it lowercase and with stray
spaces or dashes, but they will not *repair* a character outside the alphabet:
an `O` could have been misread from several things, and guessing would quietly
open somebody else's complaint.

**The address is a dropdown, not a text box.** This was the single biggest
data-quality fix. The quarters typed into the old form included `DE-11`, `De`,
`C-53:6#`, `qet` and `Guest house` — five spellings, at least two of them
unusable, and no way to group complaints by building. A fixed list of blocks
plus a number gives one canonical `DE-11`, which is what the busiest-quarters
chart and every address search depend on.

The block list is data, not code — add a block, rename one, or retire one by
editing `_blocks`. The unit number is free text until someone fills in that
block's range, so nothing had to be surveyed before going live.

**A lost token is not a dead end.** `/resolve` finds a complaint by address,
and `/status` does the same for a resident. Neither asks for a name or a phone
number any more: names are typed freehand so the spelling rarely matched, and
a technician standing at DE-24 has no reason to know the resident's number.

The cost is real and worth stating plainly. **Anyone who can pick an address
can read its complaints, see their tokens, and close them.** For a township
help desk that is an acceptable trade — every resolution records who filed it,
the resident sees the whole history, and both endpoints are rate limited — but
it is a trade. Set `STAFF_ACCESS_CODE` to put `/resolve` behind one shared
staff code if it stops being one.

**Photos never touch this server.** The browser shrinks the image on a canvas
(1600 px, q0.72 — typically 120–250 KB), asks `/api/upload-signature` for a
signature, and uploads straight to Cloudinary. The API secret stays
server-side, and the URL that comes back is checked against our own cloud name
before it is written to the sheet — otherwise a crafted request could park any
URL on the dashboard.

**Thumbnails are Cloudinary transforms, not `next/image`.** Vercel meters
image optimization; Cloudinary does the same job inside the free tier.

**The forms are open; the sheet is not.** The service-account key is
server-only — the browser never receives it, and every write goes through a
route that validates its input. Do not make the spreadsheet public.

**Names are typed, not picked.** There is no staff list. Entries are trimmed
and inner spaces collapsed, so `"ramesh   kumar "` and `"ramesh kumar"` group
together on the dashboard — but spelling is not guessed at, so `R. Verma` and
`Ramesh Verma` are still two people.

---

## Who can close a complaint

`/resolve` is **open**: the token is the key, so maintenance staff need no
accounts. The consequence is that a resident holding their own token can close
their own complaint. The resolution row records a name and a timestamp, and the
resident sees the whole history, so this is visible rather than silent.

If it turns out to matter, set `STAFF_ACCESS_CODE` in `.env.local`. The server
side is already wired; the form needs to send the code as an `x-staff-code`
header, which is a few lines in `app/resolve/ResolveForm.tsx`.

Token *recovery* is deliberately stricter than token *use*: `/status` asks for
the mobile number **and** the quarter number before it will show someone their
tokens, because one of those alone is something a neighbour would know.

---

## Layout

```
app/
  page.tsx                 three tiles (public landing)
  complaint/               the form; [token]/ is the receipt and tracker
  status/                  token lookup, and recovery by mobile + quarter
  resolve/                 the technician's closing form — no login
  admin/(dash)/            dashboard: overview, all complaints, export
  admin/login/             shared-password login
  api/complaints/          POST = file one; [token] GET = public status
  api/resolve/             the ONLY writer into Resolutions
  api/search/              find an open complaint by quarter + name
  api/lookup/              token recovery by mobile + quarter
  api/upload-signature/    Cloudinary signing
  api/export/              .xlsx generator (auth-checked)
lib/
  sheets/client.ts         thin Google Sheets v4 client
  sheets/schema.ts         tab and column names
  sheets/store.ts          reads, writes, joins, aggregations
  token.ts                 generate and normalise
  cloudinary.ts            signing (server) + cloudinary-client.ts (URLs)
  compress.ts              browser-side downscaling
  auth.ts                  signed-cookie admin session
  dates.ts                 everything IST
scripts/
  init-sheet.mjs           builds and fills the sheet
  clear-submissions.mjs    empties the two registers, keeps headers
  dev/fake-sheets.mjs      local stand-in for the Sheets API
```

---

## Developing without Google

A local stand-in for the Sheets API, so you can work offline and without quota:

```bash
node scripts/dev/fake-sheets.mjs &
GOOGLE_SHEETS_ID=test-sheet \
GOOGLE_SHEETS_API_BASE=http://127.0.0.1:8787/v4/spreadsheets \
  npm run sheet:init
```

Then add `GOOGLE_SHEETS_API_BASE=http://127.0.0.1:8787/v4/spreadsheets` to
`.env.local`. It is honoured **only** for loopback addresses, so it cannot
accidentally disable authentication against Google. Remove the line to go back
to the real spreadsheet.

---

## Known limitations

- **Records are attributable, not verifiable.** Names are typed, so a
  resolution shows who claims to have done the work, not proof that they did.
- **No video.** Photos only, by choice. Cloudinary handles video on the same
  free tier, so adding it is a variant of the existing upload route rather
  than a re-architecture.
- **No SMS.** Every provider charges. The token is shown on screen, copyable
  and printable, and `/status` recovers it.
- **One shared dashboard password**, not per-person accounts.
- **Rate limiting is per-instance and in-memory.** It blunts a script hammering
  the open form; it is not a precise quota, and it resets on redeploy.
- **Aggregations read whole tabs.** Fine for the expected 700–800 complaints a
  month for several years. If the dashboard starts to feel slow, that is the
  signal to move to Postgres.
