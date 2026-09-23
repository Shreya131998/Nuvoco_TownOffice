"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, TriangleAlert } from "lucide-react";
import { FormShell } from "@/components/forms/FormShell";
import { StatusBadge } from "@/components/StatusBadge";
import { QuarterField } from "@/components/forms/QuarterField";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { normaliseToken } from "@/lib/token";
import { formatQuarter, type Block, type ComplaintStatus } from "@/lib/types";

type Hit = {
  token: string;
  complaint_date: string;
  resident_name: string;
  issue_type_en: string;
  issue_type_hi: string;
  status: ComplaintStatus;
  overdue: boolean;
};

export default function StatusLookup({
  initialToken,
  blocks,
}: {
  initialToken: string;
  blocks: Block[];
}) {
  const router = useRouter();

  const [token, setToken] = useState(initialToken);
  const [block, setBlock] = useState("");
  const [unit, setUnit] = useState("");

  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function byToken() {
    setErr(null);
    const t = normaliseToken(token);
    if (!t) {
      setErr(
        "A token is 6 characters, like 7K3M9P. / टोकन 6 अक्षर का होता है, जैसे 7K3M9P।"
      );
      return;
    }
    // The receipt page is the real view — send them straight to it.
    router.push(`/complaint/${t}`);
  }

  async function byAddress() {
    setErr(null);
    setHits(null);
    if (!block) {
      setErr("Please choose your block. / कृपया अपना ब्लॉक चुनें।");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarter_no: formatQuarter(block, unit) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not find any complaints");
      setHits(json.complaints);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not find any complaints");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormShell title="Check status" titleHi="स्थिति देखें">
      <div className="grid gap-4">
        <Card title="I have my token" subtitle="मेरे पास टोकन है">
          <div className="grid gap-3 p-4">
            <Field
              label={
                <>
                  Token <span className="hi text-muted">/ टोकन</span>
                </>
              }
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  className={`${inputClass} font-mono text-lg uppercase tracking-widest`}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") byToken();
                  }}
                  placeholder="7K3M9P"
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={10}
                />
                <Button onClick={byToken} className="shrink-0">
                  <Search size={16} />
                  Go
                </Button>
              </div>
            </Field>
          </div>
        </Card>

        <Card title="I lost my token" subtitle="मेरा टोकन खो गया">
          <div className="grid gap-4 p-4">
            <p className="text-sm text-muted">
              Choose your address to see every complaint filed from it.
              <span className="hi mt-1 block">
                अपना पता चुनें — वहाँ से दर्ज सभी शिकायतें दिखेंगी।
              </span>
            </p>
            <QuarterField
              blocks={blocks}
              block={block}
              unit={unit}
              onBlockChange={setBlock}
              onUnitChange={setUnit}
            />
            <div>
              <Button variant="outline" onClick={byAddress} disabled={busy}>
                <Search size={16} />
                {busy ? "Searching…" : "Find my complaints / मेरी शिकायतें खोजें"}
              </Button>
            </div>
          </div>
        </Card>

        {hits && hits.length > 0 && (
          <Card title="Your complaints" subtitle="आपकी शिकायतें">
            <ul className="divide-y divide-border">
              {hits.map((h) => (
                <li key={h.token}>
                  <Link
                    href={`/complaint/${h.token}`}
                    className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-sm font-semibold">
                        {h.token}
                      </span>
                      <span className="block text-xs text-muted">
                        {h.issue_type_en}{" "}
                        <span className="hi">/ {h.issue_type_hi}</span> ·{" "}
                        {h.resident_name} · {fmtDate(h.complaint_date)}
                      </span>
                    </span>
                    <StatusBadge status={h.status} overdue={h.overdue} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {err && (
          <p className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" />
            <span>{err}</span>
          </p>
        )}

        <p className="pb-4 text-center text-sm">
          <Link href="/" className="font-medium text-primary hover:underline">
            Back to home <span className="hi">/ होम पर जाएं</span>
          </Link>
        </p>
      </div>
    </FormShell>
  );
}
