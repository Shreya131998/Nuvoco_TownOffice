import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { isAdmin } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { getAreaWork, getComplaints } from "@/lib/sheets/store";
import { OUTCOME_META, STATUS_META } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Every attachment for a record, one per line inside a single cell. */
const mediaCell = (photos: string[], video: string | null) =>
  [...photos, ...(video ? [video] : [])].join("\n");

/**
 * Three sheets: one row per complaint, one per visit, and one per round of
 * common-area work.
 *
 * A layout keyed to the Complaints tab cannot carry repeat visits without
 * either dropping the earlier ones or growing a column per visit. Splitting
 * them keeps both complete, joined on the token.
 *
 * Route handlers are not covered by the (dash) layout, so the auth check is
 * repeated here by hand.
 */
export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json(
      { error: "from and to must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const [allComplaints, allRounds] = await Promise.all([
    getComplaints(),
    getAreaWork(),
  ]);
  const rows = allComplaints.filter(
    (c) => c.complaint_date >= from && c.complaint_date <= to
  );
  const rounds = allRounds.filter(
    (w) => w.work_date >= from && w.work_date <= to
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "Nuvoco Sonadih Town Office";
  wb.created = new Date();

  const header = (ws: ExcelJS.Worksheet, cols: string[], widths: number[]) => {
    ws.columns = cols.map((c, i) => ({
      header: c,
      key: `c${i}`,
      width: widths[i] ?? 16,
    }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { vertical: "middle", wrapText: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  const PINK = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFFBDEDF" },
  };

  const complaints = wb.addWorksheet("Complaints");
  header(
    complaints,
    [
      "टोकन / Token",
      "दिनांक / Filed",
      "नाम / Name",
      "क्वार्टर / Quarter",
      "मोबाइल / Mobile",
      "समस्या / Problem",
      "विवरण / Description",
      "स्थिति / Status",
      "घंटे / Hours",
      "फोटो व वीडियो / Photos & video",
    ],
    [18, 20, 22, 12, 14, 18, 46, 18, 10, 46]
  );
  complaints.getRow(1).height = 30;

  for (const c of rows) {
    const row = complaints.addRow([
      c.token,
      fmtDateTime(c.submitted_at),
      c.resident_name,
      c.quarter_no,
      c.mobile,
      `${c.issue_type_hi}\n${c.issue_type_en}`,
      c.description,
      `${STATUS_META[c.status].hi} / ${STATUS_META[c.status].en}`,
      c.resolution_hours ?? c.age_hours,
      mediaCell(c.photo_urls, c.video_url),
    ]);
    // Overdue rows are tinted so a supervisor can scan for them.
    if (c.overdue) row.getCell(8).fill = PINK;
  }

  const visits = wb.addWorksheet("Visits");
  header(
    visits,
    [
      "टोकन / Token",
      "दिनांक / Visited",
      "कर्मचारी / Technician",
      "मोबाइल / Mobile",
      "नतीजा / Outcome",
      "किया गया कार्य / Work done",
      "फोटो / Photo",
    ],
    [18, 20, 22, 14, 22, 46, 40]
  );
  visits.getRow(1).height = 30;

  for (const c of rows) {
    for (const v of c.visits) {
      visits.addRow([
        c.token,
        fmtDateTime(v.resolved_at),
        v.technician_name,
        v.technician_mobile ?? "",
        `${OUTCOME_META[v.outcome].hi} / ${OUTCOME_META[v.outcome].en}`,
        v.action_taken,
        mediaCell(v.photo_urls, v.video_url),
      ]);
    }
  }

  // Third sheet: the common-area rounds. Kept apart from the complaint
  // sheets because it joins to neither — no token, no quarter, no resident.
  const area = wb.addWorksheet("Area Work");
  header(
    area,
    [
      "दिनांक / Date",
      "कार्य / Work",
      "क्षेत्र / Area",
      "कर्मचारी / Worker",
      "मोबाइल / Mobile",
      "क्या हुआ / What was done",
      "फोटो / Photo",
    ],
    [16, 22, 28, 22, 14, 46, 40]
  );
  area.getRow(1).height = 30;

  for (const w of rounds) {
    area.addRow([
      fmtDate(w.work_date),
      `${w.work_type_hi}\n${w.work_type_en}`,
      w.area ?? "",
      w.worker_name,
      w.worker_mobile ?? "",
      w.notes,
      mediaCell(w.photo_urls, w.video_url),
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="townoffice-complaints-${from}-to-${to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
