"use client";

import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AXIS, BAR_RADIUS, GRID, Legend, Tip } from "./chrome";
import { EmptyState } from "@/components/ui";

const SERIES = [
  { key: "raised", label: "Raised", color: "var(--chart-2)" },
  { key: "resolved", label: "Resolved", color: "var(--chart-3)" },
] as const;

export type DayRow = { day: string; raised: number; resolved: number };

/**
 * Complaints raised against complaints closed, per day.
 *
 * Grouped rather than stacked: the question this chart answers is whether the
 * town office is keeping up, and that is the gap between two bars. Stacking
 * would add them together, which means nothing.
 */
export function RaisedResolved({ data }: { data: DayRow[] }) {
  if (!data.length) return <EmptyState>No activity yet.</EmptyState>;

  const totals = SERIES.map((s) => ({
    ...s,
    value: data.reduce((sum, d) => sum + d[s.key], 0),
  }));
  if (totals.every((t) => t.value === 0)) {
    return <EmptyState>Nothing recorded in this period.</EmptyState>;
  }

  return (
    <>
      <div className="h-60 w-full px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis
              dataKey="day"
              {...AXIS}
              tickFormatter={(d: string) => d.slice(8) + "/" + d.slice(5, 7)}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis {...AXIS} allowDecimals={false} width={38} />
            <Tooltip
              cursor={{ fill: "var(--chart-grid)", opacity: 0.4 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <Tip
                    label={String(label)}
                    rows={SERIES.map((s) => ({
                      name: s.label,
                      value: payload[0].payload[s.key],
                      color: s.color,
                    }))}
                  />
                ) : null
              }
            />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                radius={BAR_RADIUS}
                maxBarSize={16}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend items={totals} />
    </>
  );
}
