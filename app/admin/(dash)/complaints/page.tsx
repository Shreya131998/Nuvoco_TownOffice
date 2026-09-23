/* eslint-disable @next/next/no-img-element -- Cloudinary already serves a
   resized, auto-format image (see lib/cloudinary-client.ts), so next/image
   would only add Vercel's metered optimizer. Running at zero cost is a
   requirement of this project, not an oversight. */
import Link from "next/link";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge, Card } from "@/components/ui";
import { thumb } from "@/lib/cloudinary-client";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { getComplaints } from "@/lib/sheets/store";
import type { Complaint } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "resolved", label: "Resolved" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function parseFilter(v: string | undefined): FilterKey {
  return FILTERS.some((f) => f.key === v) ? (v as FilterKey) : "all";
}

/**
 * Every complaint ever filed. No date range: the point of this page is to find
 * one specific complaint, and a resident asking about a month-old problem is
 * exactly the case a range filter would hide.
 */
export default async function Complaints({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const filter = parseFilter((await searchParams).status);
  const all = await getComplaints();

  const rows = all.filter((c) => {
    if (filter === "open") return c.status !== "resolved";
    if (filter === "overdue") return c.overdue;
    if (filter === "resolved") return c.status === "resolved";
    return true;
  });

  const counts: Record<FilterKey, number> = {
    all: all.length,
    open: all.filter((c) => c.status !== "resolved").length,
    overdue: all.filter((c) => c.overdue).length,
    resolved: all.filter((c) => c.status === "resolved").length,
  };

  const columns: Column<Complaint>[] = [
    {
      key: "token",
      header: "Token",
      cell: (c) => (
        <Link
          href={`/complaint/${c.token}`}
          className="font-mono text-xs font-semibold text-primary hover:underline"
        >
          {c.token}
        </Link>
      ),
    },
    {
      key: "who",
      header: "Resident",
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{c.resident_name}</p>
          <p className="truncate text-xs text-muted">
            {c.quarter_no} · {c.mobile}
          </p>
        </div>
      ),
    },
    {
      key: "issue",
      header: "Problem",
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate">{c.issue_type_en}</p>
          <p className="hi truncate text-xs text-muted">{c.issue_type_hi}</p>
        </div>
      ),
    },
    {
      key: "filed",
      header: "Filed",
      hideOnMobile: true,
      cell: (c) => (
        <span className="whitespace-nowrap text-xs">
          {fmtDate(c.complaint_date)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => <StatusBadge status={c.status} overdue={c.overdue} />,
    },
    {
      key: "closed",
      header: "Closed by",
      hideOnMobile: true,
      cell: (c) =>
        c.latest ? (
          <div className="min-w-0">
            <p className="truncate text-xs">{c.latest.technician_name}</p>
            <p className="truncate text-xs text-muted">
              {fmtDateTime(c.latest.resolved_at)}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted">—</span>
        ),
    },
    {
      key: "time",
      header: "Time",
      cell: (c) =>
        c.resolution_hours !== null ? (
          <Badge tone="ok">{c.resolution_hours}h</Badge>
        ) : (
          <Badge tone={c.overdue ? "danger" : "muted"}>{c.age_hours}h</Badge>
        ),
    },
    {
      key: "photo",
      header: "Photo",
      hideOnMobile: true,
      cell: (c) =>
        c.photo_url ? (
          <a href={c.photo_url} target="_blank" rel="noreferrer">
            <img
              src={thumb(c.photo_url, 96, 96)}
              alt={`Photo for ${c.token}`}
              width={48}
              height={48}
              className="size-12 rounded border border-border object-cover"
            />
          </a>
        ) : (
          <span className="text-xs text-muted">—</span>
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <PageHeader
        title="All complaints"
        subtitle={`${rows.length} shown of ${all.length} total`}
        action={
          <div
            role="group"
            aria-label="Filter by status"
            className="inline-flex overflow-hidden rounded-lg border border-border-strong bg-surface"
          >
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === "all" ? "?" : `?status=${f.key}`}
                className={`px-3 py-1.5 text-xs font-semibold transition ${
                  filter === f.key
                    ? "bg-primary text-primary-fg"
                    : "text-muted hover:bg-surface-2"
                }`}
              >
                {f.label} ({counts[f.key]})
              </Link>
            ))}
          </div>
        }
      />

      <Card>
        <DataTable<Complaint>
          columns={columns}
          rows={rows}
          rowKey={(c) => c.token}
          empty="No complaints match this filter."
        />
      </Card>
    </div>
  );
}
