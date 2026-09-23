import Link from "next/link";
import {
  AlarmClock,
  CheckCircle2,
  Inbox,
  MessageSquarePlus,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { RangeToggle } from "@/components/dashboard/RangeToggle";
import { RaisedResolved } from "@/components/charts/RaisedResolved";
import { RankedBar } from "@/components/charts/RankedBar";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge, Card, EmptyState } from "@/components/ui";
import { fmtDate, parseRange, resolveRange } from "@/lib/dates";
import {
  getActivity,
  getByIssueType,
  getQuarterCounts,
  getDailyCounts,
  getOpenComplaints,
  getSpeedByIssueType,
  getSummary,
} from "@/lib/sheets/store";

export const dynamic = "force-dynamic";

export default async function Overview({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const range = parseRange((await searchParams).range);
  const window = resolveRange(range);

  const [summary, daily, byType, byQuarter, speed, open, activity] =
    await Promise.all([
      getSummary(window),
      getDailyCounts(window),
      getByIssueType(window),
      getQuarterCounts(window),
      getSpeedByIssueType(window),
      getOpenComplaints(),
      getActivity(window),
    ]);

  const oldest = open.slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <PageHeader
        title="Complaints overview"
        subtitle="SCP Township help desk"
        action={<RangeToggle value={range} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile
          label="Raised today"
          value={summary.raisedToday}
          sub="आज दर्ज"
          icon={MessageSquarePlus}
          tone="info"
        />
        <KpiTile
          label="Resolved today"
          value={summary.resolvedToday}
          sub="आज हल"
          icon={CheckCircle2}
          tone="ok"
        />
        <KpiTile
          label="Open now"
          value={summary.openNow}
          sub="अभी लंबित"
          icon={Inbox}
          tone={summary.openNow > 0 ? "warn" : "ok"}
        />
        <KpiTile
          label="Overdue"
          value={summary.overdue}
          sub="देरी से"
          icon={AlarmClock}
          tone={summary.overdue > 0 ? "danger" : "ok"}
        />
        <KpiTile
          label="Avg time to fix"
          value={
            summary.avgResolutionHours === null
              ? "—"
              : `${summary.avgResolutionHours} h`
          }
          sub={`${summary.resolvedInRange} resolved`}
          icon={Timer}
          tone="muted"
        />
      </div>

      {summary.overdue > 0 && (
        <Link
          href="/admin/complaints?status=overdue"
          className="mt-4 flex items-start gap-3 rounded-card border border-border bg-danger-soft p-4 text-danger transition hover:shadow-sm"
        >
          <TriangleAlert size={20} className="mt-0.5 shrink-0" />
          <span className="min-w-0 text-sm">
            <span className="block font-semibold">
              {summary.overdue} complaint{summary.overdue === 1 ? "" : "s"} past
              the target turnaround
            </span>
            <span className="hi block">
              {summary.overdue} शिकायत तय समय से आगे निकल चुकी है
            </span>
          </span>
        </Link>
      )}

      <Card
        className="mt-4"
        title="Raised vs resolved"
        subtitle={`${window.from} → ${window.to}`}
      >
        <RaisedResolved data={daily} />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="By type of problem" subtitle="समस्या के प्रकार से">
          <RankedBar
            data={byType}
            unit="complaints"
            color="var(--chart-2)"
            empty="Nothing raised in this period."
          />
        </Card>
        <Card title="Busiest quarters" subtitle="सबसे अधिक शिकायत वाले क्वार्टर">
          <RankedBar
            data={byQuarter}
            unit="complaints"
            color="var(--chart-1)"
            empty="Nothing raised in this period."
            max={10}
          />
        </Card>
      </div>

      <Card
        className="mt-4"
        title="Average hours to fix, by trade"
        subtitle="Only counts complaints closed in this period"
      >
        <RankedBar
          data={speed}
          unit="hours"
          color="var(--chart-3)"
          empty="Nothing resolved in this period."
        />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          title="Oldest still open"
          subtitle="सबसे पुरानी लंबित शिकायतें"
          action={
            <Link
              href="/admin/complaints"
              className="text-xs font-semibold text-primary hover:underline"
            >
              See all
            </Link>
          }
        >
          {oldest.length === 0 ? (
            <EmptyState>Nothing is open. Everything has been closed.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {oldest.map((c) => (
                <li key={c.token}>
                  <Link
                    href={`/complaint/${c.token}`}
                    className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {c.quarter_no} · {c.issue_type_en}
                      </span>
                      <span className="block text-xs text-muted">
                        {c.resident_name} · {fmtDate(c.complaint_date)} ·{" "}
                        <span className="font-mono">{c.token}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge tone="muted">{c.age_hours}h old</Badge>
                      <StatusBadge status={c.status} overdue={c.overdue} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent activity" subtitle="हाल की गतिविधि">
          <ActivityFeed rows={activity} />
        </Card>
      </div>
    </div>
  );
}
