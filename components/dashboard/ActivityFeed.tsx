import { MessageSquarePlus, Wrench } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";
import type { Activity, ActivityKind } from "@/lib/types";

const ICON: Record<ActivityKind, typeof Wrench> = {
  raised: MessageSquarePlus,
  resolved: Wrench,
};

const TONE: Record<ActivityKind, string> = {
  raised: "bg-warn-soft text-warn",
  resolved: "bg-ok-soft text-ok",
};

const VERB: Record<ActivityKind, string> = {
  raised: "raised a complaint",
  resolved: "recorded a visit",
};

/** Complaints and visits interleaved, newest first. */
export function ActivityFeed({
  rows,
  limit = 14,
}: {
  rows: Activity[];
  limit?: number;
}) {
  if (rows.length === 0) {
    return <EmptyState>Nothing happened in this period.</EmptyState>;
  }

  return (
    <ul className="divide-y divide-border">
      {rows.slice(0, limit).map((r) => {
        const Icon = ICON[r.kind];
        return (
          <li key={`${r.kind}-${r.token}-${r.at}`} className="flex gap-3 p-4">
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-lg ${TONE[r.kind]}`}
            >
              <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{r.person}</span>{" "}
                <span className="text-muted">{VERB[r.kind]}</span>
              </p>
              <p className="text-xs text-muted">
                {r.quarter_no} · {r.issue_type_en} ·{" "}
                <span className="font-mono">{r.token}</span>
              </p>
              {r.detail && (
                <p className="mt-1 line-clamp-2 text-xs italic text-muted">
                  “{r.detail}”
                </p>
              )}
            </div>
            <span className="shrink-0 whitespace-nowrap text-xs text-muted">
              {fmtDateTime(r.at)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
