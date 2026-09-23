"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { FormShell, SubmitBar } from "@/components/forms/FormShell";
import { PhotoField, type UploadedPhoto } from "@/components/forms/PhotoField";
import { QuarterField } from "@/components/forms/QuarterField";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { formatQuarter, type Block, type IssueType } from "@/lib/types";

export default function ComplaintForm({
  issueTypes,
  blocks,
  photos,
}: {
  issueTypes: IssueType[];
  blocks: Block[];
  photos: boolean;
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [block, setBlock] = useState("");
  const [unit, setUnit] = useState("");
  const [mobile, setMobile] = useState("");
  const [issueTypeId, setIssueTypeId] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<UploadedPhoto | null>(null);

  // A bot fills every field it finds. A human never sees this one.
  const [website, setWebsite] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!name.trim()) return setErr("Please enter your name. / कृपया अपना नाम लिखें।");
    if (!block)
      return setErr("Please choose your block. / कृपया अपना ब्लॉक चुनें।");
    if (!/^[6-9]\d{9}$/.test(mobile.replace(/\D/g, "").replace(/^(91|0)/, "")))
      return setErr("Please enter a 10-digit mobile number. / 10 अंकों का मोबाइल नंबर लिखें।");
    if (!issueTypeId)
      return setErr("Please choose the type of problem. / कृपया समस्या का प्रकार चुनें।");
    if (description.trim().length < 10)
      return setErr(
        "Please describe the problem in a little more detail. / कृपया समस्या थोड़ा विस्तार से बताएं।"
      );

    setBusy(true);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resident_name: name,
          quarter_no: formatQuarter(block, unit),
          mobile,
          issue_type_id: issueTypeId,
          description,
          photo_url: photo?.url ?? null,
          photo_public_id: photo?.publicId ?? null,
          website,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not submit");
      // The receipt page is the record — going there rather than showing an
      // inline success means the resident can bookmark or reload it later.
      router.push(`/complaint/${json.token}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit");
      setBusy(false);
    }
  }

  return (
    <FormShell title="Raise a complaint" titleHi="शिकायत दर्ज करें">
      <div className="grid gap-4">
        <Card title="1. Your details" subtitle="आपकी जानकारी">
          <div className="grid gap-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
            <Field
              required
              label={
                <>
                  Full name <span className="hi text-muted">/ पूरा नाम</span>
                </>
              }
            >
              <input
                type="text"
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                autoComplete="name"
                maxLength={80}
              />
            </Field>

            <Field
              required
              label={
                <>
                  Mobile no. <span className="hi text-muted">/ मोबाइल नं.</span>
                </>
              }
              hint="So the town office can reach you / ताकि टाउन ऑफिस संपर्क कर सके"
            >
              <input
                type="tel"
                inputMode="numeric"
                className={inputClass}
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="10-digit mobile number"
                autoComplete="tel"
                maxLength={15}
              />
            </Field>

            <Field
              required
              label={
                <>
                  Type of problem{" "}
                  <span className="hi text-muted">/ समस्या का प्रकार</span>
                </>
              }
            >
              <select
                className={inputClass}
                value={issueTypeId}
                onChange={(e) => setIssueTypeId(e.target.value)}
              >
                <option value="">Select an issue… / चुनें…</option>
                {issueTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label_en} / {t.label_hi}
                  </option>
                ))}
              </select>
            </Field>
            </div>

            <QuarterField
              required
              blocks={blocks}
              block={block}
              unit={unit}
              onBlockChange={setBlock}
              onUnitChange={setUnit}
            />
          </div>
        </Card>

        <Card title="2. The problem" subtitle="समस्या का विवरण">
          <div className="grid gap-4 p-4">
            <Field
              required
              label={
                <>
                  Describe the problem{" "}
                  <span className="hi text-muted">/ समस्या बताएं</span>
                </>
              }
              hint="Where exactly, since when / कहाँ, कब से"
            >
              <textarea
                className={inputClass}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Bathroom tap leaking since Monday, water collecting on the floor."
                maxLength={2000}
              />
            </Field>

            <PhotoField value={photo} onChange={setPhoto} enabled={photos} />
          </div>
        </Card>

        {/* Honeypot. Hidden from sight and from screen readers; only a bot
            fills it, and the server rejects the submission when it is set. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="absolute left-[-9999px] size-px opacity-0"
        />

        {err && (
          <p className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" />
            <span>{err}</span>
          </p>
        )}
      </div>

      <SubmitBar>
        <span className="min-w-0 flex-1 truncate text-xs text-muted">
          You will get a token to show the repair staff.
        </span>
        <Button onClick={submit} disabled={busy}>
          {busy ? "Submitting…" : "Submit / जमा करें"}
        </Button>
      </SubmitBar>
    </FormShell>
  );
}
