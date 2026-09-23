"use client";

import { useState } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { PhotoField, type UploadedPhoto } from "@/components/forms/PhotoField";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { istToday } from "@/lib/dates";
import type { WorkType } from "@/lib/types";

/**
 * Logging a round of common-area work — road sweeping, a garbage collection.
 *
 * No token and no quarter, by design: this answers to no complaint and covers
 * no single house. What it does need is a date, because a round is written up
 * at the end of a shift or the next morning, not the moment it happens.
 */
export function AreaWorkForm({
  workTypes,
  photos,
  onSaved,
}: {
  workTypes: WorkType[];
  photos: boolean;
  onSaved: () => void;
}) {
  const today = istToday();

  const [workTypeId, setWorkTypeId] = useState("");
  const [workDate, setWorkDate] = useState(today);
  const [area, setArea] = useState("");
  const [who, setWho] = useState("");
  const [mobile, setMobile] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<UploadedPhoto | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function reset() {
    // The type and the worker usually repeat across a shift, so they stay.
    // The area and the notes are what change round to round.
    setArea("");
    setNotes("");
    setPhoto(null);
    setErr(null);
    setDone(null);
  }

  async function submit() {
    setErr(null);
    if (!workTypeId)
      return setErr("Please choose the type of work. / कृपया कार्य का प्रकार चुनें।");
    if (!who.trim())
      return setErr("Please enter your name. / कृपया अपना नाम लिखें।");
    if (notes.trim().length < 5)
      return setErr("Please describe what was done. / कृपया बताएं क्या काम हुआ।");

    setBusy(true);
    try {
      const res = await fetch("/api/area-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          work_date: workDate,
          work_type_id: workTypeId,
          area: area.trim() || null,
          worker_name: who,
          worker_mobile: mobile.trim() || null,
          notes,
          photo_url: photo?.url ?? null,
          photo_public_id: photo?.publicId ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      setDone(workTypes.find((t) => t.id === workTypeId)?.label_en ?? "Work");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card className="p-6 text-center">
        <CheckCircle2 size={44} className="mx-auto text-ok" />
        <h2 className="mt-3 text-lg font-semibold">Saved</h2>
        <p className="hi mt-1 text-sm text-muted">दर्ज हो गया</p>
        <p className="mt-2 text-sm text-muted">
          {done} · {workDate}
        </p>
        <div className="mt-5">
          <Button onClick={reset}>Log another round / एक और दर्ज करें</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card title="Area work" subtitle="सामान्य क्षेत्र का कार्य">
        <div className="grid gap-4 p-4">
          <p className="text-sm text-muted">
            For work that is not about one house — road sweeping, garbage
            rounds. No token and no quarter number needed.
            <span className="hi mt-1 block">
              ऐसा कार्य जो किसी एक घर का न हो — सड़क सफाई, कचरा संग्रहण। टोकन
              या क्वार्टर नंबर की ज़रूरत नहीं।
            </span>
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              required
              label={
                <>
                  Type of work{" "}
                  <span className="hi text-muted">/ कार्य का प्रकार</span>
                </>
              }
            >
              <select
                className={inputClass}
                value={workTypeId}
                onChange={(e) => setWorkTypeId(e.target.value)}
              >
                <option value="">Select… / चुनें…</option>
                {workTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label_en} / {t.label_hi}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              required
              label={
                <>
                  Date <span className="hi text-muted">/ दिनांक</span>
                </>
              }
              hint="The day the work was done / जिस दिन काम हुआ"
            >
              <input
                type="date"
                className={inputClass}
                value={workDate}
                max={today}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            </Field>
          </div>

          <Field
            label={
              <>
                Area covered <span className="hi text-muted">/ क्षेत्र</span>
              </>
            }
            hint="Optional — e.g. main road, behind D block / वैकल्पिक"
          >
            <input
              type="text"
              className={inputClass}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g. Main road and B block lane"
              maxLength={120}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              required
              label={
                <>
                  Your name <span className="hi text-muted">/ आपका नाम</span>
                </>
              }
            >
              <input
                type="text"
                className={inputClass}
                value={who}
                onChange={(e) => setWho(e.target.value)}
                placeholder="e.g. Ravi Das"
                autoComplete="name"
                maxLength={80}
              />
            </Field>
            <Field
              label={
                <>
                  Your mobile <span className="hi text-muted">/ आपका मोबाइल</span>
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

          <Field
            required
            label={
              <>
                What was done{" "}
                <span className="hi text-muted">/ क्या काम हुआ</span>
              </>
            }
          >
            <textarea
              className={inputClass}
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Swept the main road and both lanes, cleared two bins."
              maxLength={2000}
            />
          </Field>

          <PhotoField
            value={photo}
            onChange={setPhoto}
            enabled={photos}
            label="Photo of the work"
            labelHi="कार्य की फोटो"
          />
        </div>
      </Card>

      {err && (
        <p className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Submit / जमा करें"}
        </Button>
      </div>
    </div>
  );
}
