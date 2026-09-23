import { Badge } from "@/components/ui";
import { STATUS_META, type ComplaintStatus } from "@/lib/types";

export function StatusBadge({
  status,
  overdue = false,
}: {
  status: ComplaintStatus;
  overdue?: boolean;
}) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={meta.tone}>
        {meta.en} <span className="hi">/ {meta.hi}</span>
      </Badge>
      {overdue && (
        <Badge tone="danger">
          Overdue <span className="hi">/ देरी</span>
        </Badge>
      )}
    </span>
  );
}
