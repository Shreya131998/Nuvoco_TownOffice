"use client";

/* eslint-disable @next/next/no-img-element -- Cloudinary already serves a
   resized, auto-format image (see lib/cloudinary-client.ts), so next/image
   would only add Vercel's metered optimizer. Running at zero cost is a
   requirement of this project, not an oversight. */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Search, TriangleAlert } from "lucide-react";
import { FormShell, SubmitBar } from "@/components/forms/FormShell";
import { PhotoField, type UploadedPhoto } from "@/components/forms/PhotoField";
import { QuarterField } from "@/components/forms/QuarterField";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { thumb } from "@/lib/cloudinary-client";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { normaliseToken } from "@/lib/token";
import type { PublicComplaint } from "@/lib/public-complaint";
import { formatQuarter, OUTCOME_META, type Block, type Outcome } from "@/lib/types";

const OUTCOMES: Outcome[] = ["resolved", "partial", "not_possible"];

export default function ResolveForm({
  initialToken,
  initialComplaint,
  blocks,
  photos,
}: {
  initialToken: string;
  initialComplaint: PublicComplaint | null;
  blocks: Block[];
  photos: boolean;
}) {
  const router = useRouter();

  // Two ways in. Token is faster when the resident still has their slip;
  // the address is the fallback when they have lost it, which at a doorstep is
  // common enough that it cannot be a dead end.
  const [mode, setMode] = useState<"token" | "address">("token");
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [block, setBlock] = useState("");
  const [unit, setUnit] = useState("");

  // A ?token= link arrives already resolved by the server, so there is no
  // effect here and no empty flash before the complaint appears.
  const [found, setFound] = useState<PublicComplaint | null>(initialComplaint);
  const [choices, setChoices] = useState<PublicComplaint[] | null>(null);
  const [looking, setLooking] = useState(false);

  const [who, setWho] = useState("");
  const [mobile, setMobile] = useState("");
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [action, setAction] = useState("");
  const [photo, setPhoto] = useState<UploadedPhoto | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function lookupByToken() {
    setErr(null);
    setChoices(null);
    setFound(null);
    const token = normaliseToken(tokenInput);
    if (!token) {
      setErr(
        "A token is 6 characters, like 7K3M9P. / टोकन 6 अक्षर का होता है, जैसे 7K3M9P।"
      );
      return;
    }
    setLooking(true);
    try {
      const res = await fetch(`/api/complaints/${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not find that token");
      setFound(json.complaint);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not find that token");
    } finally {
      setLooking(false);
    }
  }

  async function lookupByAddress() {
    setErr(null);
    setChoices(null);
    setFound(null);
    if (!block) {
      setErr("Please choose the block. / कृपया ब्लॉक चुनें।");
      return;
    }
    setLooking(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarter_no: formatQuarter(block, unit) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not find a complaint");
      // One hit is the common case — skip the pick-one step entirely.
      // Always keep the list: it is what the dropdown below renders, and a
      // technician who picked the wrong one needs to be able to switch.
      setChoices(json.complaints);
      if (json.complaints.length === 1) setFound(json.complaints[0]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not find a complaint");
    } finally {
      setLooking(false);
    }
  }

  function startOver() {
    setTokenInput("");
    setBlock("");
    setUnit("");
    setFound(null);
    setChoices(null);
    setWho("");
    setMobile("");
    setOutcome("");
    setAction("");
    setPhoto(null);
    setErr(null);
    setDone(false);
  }

  async function submit() {
    setErr(null);
    if (!found) {
      return setErr(
        "Find the complaint first, by token or by address. / पहले शिकायत खोजें।"
      );
    }
    if (!who.trim()) return setErr("Please enter your name. / कृपया अपना नाम लिखें।");
    if (!outcome)
      return setErr("Please choose what happened. / कृपया बताएं क्या हुआ।");
    if (action.trim().length < 5)
      return setErr("Please describe the work done. / कृपया किया गया कार्य बताएं।");

    setBusy(true);
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: found.token,
          technician_name: who,
          technician_mobile: mobile.trim() || null,
          outcome,
          action_taken: action,
          photo_url: photo?.url ?? null,
          photo_public_id: photo?.publicId ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (done && found) {
    return (
      <FormShell title="Complaint updated" titleHi="शिकायत अपडेट हुई">
        <Card className="p-6 text-center">
          <CheckCircle2 size={44} className="mx-auto text-ok" />
          <h2 className="mt-3 text-lg font-semibold">Saved</h2>
          <p className="hi mt-1 text-sm text-muted">दर्ज हो गया</p>
          <p className="mt-3 font-mono text-lg font-bold tracking-widest">
            {found.token}
          </p>
          <p className="mt-1 text-sm text-muted">
            {found.quarter_no} · {found.issue_type_en}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {/* Clearing state beats reloading: a technician closing several
                complaints in a row keeps the page warm. */}
            <Button onClick={startOver}>Next complaint / अगली शिकायत</Button>
            <Button variant="outline" onClick={() => router.push("/")}>
              Home / होम
            </Button>
          </div>
        </Card>
      </FormShell>
    );
  }

  return (
    <FormShell title="Close a complaint" titleHi="शिकायत बंद करें">
      <div className="grid gap-4">
        <Card title="1. Find the complaint" subtitle="शिकायत खोजें">
          <div className="grid gap-4 p-4">
            <div
              role="group"
              aria-label="How to find the complaint"
              className="grid grid-cols-2 overflow-hidden rounded-lg border border-border-strong"
            >
              <button
                type="button"
                aria-pressed={mode === "token"}
                onClick={() => setMode("token")}
                className={`px-3 py-2.5 text-sm font-semibold transition ${
                  mode === "token"
                    ? "bg-primary text-primary-fg"
                    : "bg-surface text-muted hover:bg-surface-2"
                }`}
              >
                By token
                <span className="hi block text-xs font-normal">टोकन से</span>
              </button>
              <button
                type="button"
                aria-pressed={mode === "address"}
                onClick={() => setMode("address")}
                className={`px-3 py-2.5 text-sm font-semibold transition ${
                  mode === "address"
                    ? "bg-primary text-primary-fg"
                    : "bg-surface text-muted hover:bg-surface-2"
                }`}
              >
                By address
                <span className="hi block text-xs font-normal">पते से</span>
              </button>
            </div>

            {mode === "token" ? (
              <Field
                label={
                  <>
                    Token <span className="hi text-muted">/ टोकन</span>
                  </>
                }
                hint="6 characters, from the resident's slip / निवासी की पर्ची से 6 अक्षर"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    className={`${inputClass} font-mono text-lg uppercase tracking-widest`}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void lookupByToken();
                    }}
                    placeholder="7K3M9P"
                    autoCapitalize="characters"
                    autoComplete="off"
                    maxLength={10}
                  />
                  <Button
                    variant="outline"
                    onClick={() => void lookupByToken()}
                    disabled={looking}
                    className="shrink-0"
                  >
                    <Search size={16} />
                    {looking ? "Finding…" : "Find"}
                  </Button>
                </div>
              </Field>
            ) : (
              <div className="grid gap-4">
                <p className="text-sm text-muted">
                  Pick the address you were sent to.
                  <span className="hi mt-1 block">
                    जिस पते पर आप गए थे, उसे चुनें।
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
                  <Button
                    variant="outline"
                    onClick={() => void lookupByAddress()}
                    disabled={looking}
                  >
                    <Search size={16} />
                    {looking ? "Searching…" : "Search / खोजें"}
                  </Button>
                </div>
              </div>
            )}

            {/* Which of that address's open complaints this visit closed.
                A dropdown rather than a list: it matches the block picker
                above, and the full details appear in section 2 the moment one
                is chosen, so the option text only has to distinguish them. */}
            {choices && choices.length > 0 && (
              <Field
                required
                label={
                  <>
                    Which complaint did you close?{" "}
                    <span className="hi text-muted">
                      / आपने कौन सी शिकायत बंद की?
                    </span>
                  </>
                }
                hint={`${choices.length} open at this address / इस पते पर ${choices.length} लंबित`}
              >
                <select
                  className={inputClass}
                  value={found?.token ?? ""}
                  onChange={(e) => {
                    const hit = choices.find((c) => c.token === e.target.value);
                    setFound(hit ?? null);
                  }}
                >
                  <option value="">Select… / चुनें…</option>
                  {choices.map((c) => (
                    <option key={c.token} value={c.token}>
                      {c.issue_type_en} / {c.issue_type_hi} — {fmtDate(c.complaint_date)} — {c.token}
                    </option>
                  ))}
                </select>
              </Field>
            )}

          </div>
        </Card>

        {found && (
          <Card title="2. The complaint" subtitle="शिकायत">
            <div className="grid gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={found.status} overdue={found.overdue} />
                <span className="font-mono text-sm font-bold tracking-widest text-primary">
                  {found.token}
                </span>
              </div>
              <p className="text-sm">
                <span className="font-semibold">{found.resident_name}</span> ·{" "}
                {found.quarter_no}
              </p>
              <p className="text-sm text-muted">
                {found.issue_type_en}{" "}
                <span className="hi">/ {found.issue_type_hi}</span> ·{" "}
                {fmtDateTime(found.submitted_at)}
              </p>
              <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm">
                {found.description}
              </p>

              {found.photo_url && (
                <img
                  src={thumb(found.photo_url, 320, 320)}
                  alt="Photo filed with the complaint"
                  width={160}
                  height={160}
                  className="size-40 rounded-lg border border-border object-cover"
                />
              )}

              {/* Someone has been here before. What they tried is the most
                  useful thing this screen can tell the next person. */}
              {found.visits.length > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold text-muted">
                    Earlier visits <span className="hi">/ पिछली विज़िट</span>
                  </p>
                  <ul className="mt-2 grid gap-2">
                    {found.visits.map((v) => (
                      <li key={v.resolved_at} className="text-xs">
                        <span className="font-medium">{v.technician_name}</span>
                        <span className="text-muted">
                          {" "}
                          · {fmtDateTime(v.resolved_at)} ·{" "}
                          {OUTCOME_META[v.outcome].en}
                        </span>
                        <p className="text-muted">{v.action_taken}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Always visible, found or not. Hiding it until a complaint loaded
            made the page look like it only ever wanted a token. */}
        <Card
          title="3. Your details and the work done"
          subtitle="आपका विवरण एवं किया गया कार्य"
        >
          <div className="grid gap-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                required
                label={
                  <>
                    Your name <span className="hi text-muted">/ आपका नाम</span>
                  </>
                }
                hint="The person who did the work / जिसने काम किया"
              >
                <input
                  type="text"
                  className={inputClass}
                  value={who}
                  onChange={(e) => setWho(e.target.value)}
                  placeholder="e.g. Suresh Yadav"
                  autoComplete="name"
                  maxLength={80}
                />
              </Field>
              <Field
                label={
                  <>
                    Your mobile{" "}
                    <span className="hi text-muted">/ आपका मोबाइल</span>
                  </>
                }
              >
                <input
                  type="tel"
                  inputMode="numeric"
                  className={inputClass}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Optional"
                  maxLength={15}
                />
              </Field>
            </div>

            <div>
              <span className="flex items-baseline gap-1.5 text-sm font-medium">
                What happened <span className="hi text-muted">/ क्या हुआ</span>
                <span className="text-danger">*</span>
              </span>
              <div
                role="group"
                aria-label="Outcome of the visit"
                className="mt-1.5 grid gap-2"
              >
                {OUTCOMES.map((o) => {
                  const meta = OUTCOME_META[o];
                  const on = outcome === o;
                  return (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setOutcome(o)}
                      className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                        on
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border-strong hover:bg-surface-2"
                      }`}
                    >
                      <span className="block font-semibold">{meta.en}</span>
                      <span className="hi block text-xs opacity-80">{meta.hi}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Field
              required
              label={
                <>
                  What you solved{" "}
                  <span className="hi text-muted">/ आपने क्या ठीक किया</span>
                </>
              }
              hint="What was wrong, and what you replaced or repaired / क्या खराबी थी, क्या बदला या ठीक किया"
            >
              <textarea
                className={inputClass}
                rows={4}
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="e.g. Replaced the tap washer and seat. Ran the tap for five minutes, no leak."
                maxLength={2000}
              />
            </Field>

            <PhotoField
              value={photo}
              onChange={setPhoto}
              enabled={photos}
              label="Photo after the work"
              labelHi="काम के बाद की फोटो"
            />
          </div>
        </Card>

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

      <SubmitBar>
        <span className="min-w-0 flex-1 truncate text-xs text-muted">
          {found ? (
            <>
              Closing{" "}
              <span className="font-mono font-bold tracking-widest">
                {found.token}
              </span>
            </>
          ) : (
            "Find the complaint above first"
          )}
        </span>
        <Button onClick={submit} disabled={busy || !found}>
          {busy ? "Saving…" : "Submit / जमा करें"}
        </Button>
      </SubmitBar>
    </FormShell>
  );
}
