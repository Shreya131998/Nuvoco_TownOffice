/* eslint-disable @next/next/no-img-element -- Cloudinary already serves a
   resized, auto-format image (see lib/cloudinary-client.ts), so next/image
   would only add Vercel's metered optimizer. Running at zero cost is a
   requirement of this project, not an oversight. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormShell } from "@/components/forms/FormShell";
import { TokenCard } from "@/components/TokenCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui";
import { fit, thumb } from "@/lib/cloudinary";
import { fmtDateTime } from "@/lib/dates";
import { getByToken } from "@/lib/sheets/store";
import { normaliseToken } from "@/lib/token";
import { OUTCOME_META, type Tone } from "@/lib/types";

export const dynamic = "force-dynamic";

// Written out in full because Tailwind only generates classes it can see as
// complete strings — `text-${tone}` produces nothing at build time.
const TONE_TEXT: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  info: "text-info",
  primary: "text-primary",
  muted: "text-muted",
};

/**
 * The resident's receipt, and the page they reload later to see progress.
 * The URL is the token, so it survives a bookmark, a screenshot or a
 * forwarded WhatsApp message.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const token = normaliseToken((await params).token);
  if (!token) notFound();

  const c = await getByToken(token);
  if (!c) notFound();

  return (
    <FormShell title="Your complaint" titleHi="आपकी शिकायत">
      <div className="grid gap-4">
        <TokenCard token={c.token} />

        <Card title="Status" subtitle="स्थिति">
          <div className="grid gap-3 p-4">
            <StatusBadge status={c.status} overdue={c.overdue} />
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Row label="Filed" labelHi="दर्ज" value={fmtDateTime(c.submitted_at)} />
              <Row
                label="Problem"
                labelHi="समस्या"
                value={`${c.issue_type_en} / ${c.issue_type_hi}`}
              />
              <Row label="Name" labelHi="नाम" value={c.resident_name} />
              <Row label="Quarter" labelHi="क्वार्टर" value={c.quarter_no} />
            </dl>
            <div>
              <p className="text-xs font-medium text-muted">
                Description <span className="hi">/ विवरण</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.description}</p>
            </div>
            {c.photo_url && (
              <a href={fit(c.photo_url)} target="_blank" rel="noreferrer">
                    <img
                  src={thumb(c.photo_url, 320, 320)}
                  alt="Photo attached to this complaint"
                  width={160}
                  height={160}
                  className="size-40 rounded-lg border border-border object-cover"
                />
              </a>
            )}
          </div>
        </Card>

        <Card title="Work history" subtitle="कार्य विवरण">
          {c.visits.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted">
              No one has visited yet. You will be contacted on{" "}
              {c.mobile.slice(0, 2)}xxxxxx{c.mobile.slice(-2)}.
              <span className="hi mt-1 block">
                अभी तक कोई नहीं आया है। आपसे संपर्क किया जाएगा।
              </span>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {/* Oldest first: a repeat visit reads as a story, not a stack. */}
              {c.visits.map((v) => {
                const meta = OUTCOME_META[v.outcome];
                return (
                  <li key={v.id} className="p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">{v.technician_name}</p>
                      <p className="text-xs text-muted">{fmtDateTime(v.resolved_at)}</p>
                    </div>
                    <p className={`mt-1 text-sm font-semibold ${TONE_TEXT[meta.tone]}`}>
                      {meta.en} <span className="hi">/ {meta.hi}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
                      {v.action_taken}
                    </p>
                    {v.photo_url && (
                      <a href={fit(v.photo_url)} target="_blank" rel="noreferrer">
                        <img
                          src={thumb(v.photo_url, 200, 200)}
                          alt="Photo taken after the work"
                          width={100}
                          height={100}
                          className="mt-2 size-24 rounded-lg border border-border object-cover"
                        />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <p className="pb-4 text-center text-sm no-print">
          <Link href="/" className="font-medium text-primary hover:underline">
            Back to home <span className="hi">/ होम पर जाएं</span>
          </Link>
        </p>
      </div>
    </FormShell>
  );
}

function Row({
  label,
  labelHi,
  value,
}: {
  label: string;
  labelHi: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted">
        {label} <span className="hi">/ {labelHi}</span>
      </dt>
      <dd className="truncate text-sm">{value}</dd>
    </div>
  );
}
