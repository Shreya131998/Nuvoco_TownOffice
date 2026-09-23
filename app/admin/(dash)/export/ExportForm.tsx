"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { addDays, istToday } from "@/lib/dates";

export default function ExportForm() {
  const today = istToday();
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);

  const invalid = from > to;
  const href = `/api/export?from=${from}&to=${to}`;

  return (
    <Card
      title="Choose a date range"
      subtitle="Filtered on the date each complaint was filed"
    >
      <div className="grid gap-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From">
            <input
              type="date"
              className={inputClass}
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              className={inputClass}
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>

        <p className="text-sm text-muted">
          A complaint filed inside this range brings all of its visits with it,
          even ones recorded later.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {/* A real anchor, not a router push — this is a file download, and
              client-side navigation would swallow it. */}
          <a
            href={invalid ? undefined : href}
            download
            aria-disabled={invalid}
            className={
              "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 " +
              "text-sm font-semibold text-primary-fg transition hover:opacity-90 " +
              (invalid ? "pointer-events-none opacity-50" : "")
            }
          >
            <Download size={16} />
            Download Excel
          </a>
          {invalid && (
            <span className="text-xs text-danger">
              “From” must be before “To”.
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
