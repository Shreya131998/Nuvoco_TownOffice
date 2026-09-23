"use client";

import { Field, inputClass } from "@/components/ui";
import type { Block } from "@/lib/types";

/**
 * Picking a quarter: a block from the master list, then its number.
 *
 * Free text was wrong for this. "A-104", "a 104", "A104" and "Quarter A-104"
 * are one place to a person and four to a computer, which broke the busiest-
 * quarters chart and made finding a complaint by address hopeless. A fixed
 * list of blocks fixes the half that never varies and leaves the number as
 * the only thing anyone types.
 *
 * The number is a dropdown when the block's master row carries a range, and a
 * plain box when it does not — so this works before anyone has written the
 * ranges down, and tightens up per block as they do. A place with no units at
 * all, like the temple, simply has nothing to fill in.
 *
 * Shared by the resident's form and the technician's search so the two always
 * offer the same addresses.
 */
export function QuarterField({
  blocks,
  block,
  unit,
  onBlockChange,
  onUnitChange,
  required = false,
  label = "Quarter no.",
  labelHi = "क्वार्टर नं.",
}: {
  blocks: Block[];
  block: string;
  unit: string;
  onBlockChange: (v: string) => void;
  onUnitChange: (v: string) => void;
  required?: boolean;
  label?: string;
  labelHi?: string;
}) {
  const picked = blocks.find((b) => b.label_en === block);
  const range =
    picked && picked.unit_from !== null && picked.unit_to !== null
      ? { from: picked.unit_from, to: picked.unit_to }
      : null;

  const units = range
    ? Array.from({ length: range.to - range.from + 1 }, (_, i) => range.from + i)
    : [];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        required={required}
        label={
          <>
            Block / building{" "}
            <span className="hi text-muted">/ ब्लॉक या भवन</span>
          </>
        }
      >
        <select
          className={inputClass}
          value={block}
          onChange={(e) => {
            onBlockChange(e.target.value);
            // The old number belongs to the old block. Keeping it would offer
            // "Temple-104" or a number outside the new block's range.
            onUnitChange("");
          }}
        >
          <option value="">Select… / चुनें…</option>
          {blocks.map((b) => (
            <option key={b.id} value={b.label_en}>
              {b.label_en} / {b.label_hi}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={
          <>
            {label} <span className="hi text-muted">/ {labelHi}</span>
          </>
        }
        hint="Leave blank if there is no number / नंबर न हो तो खाली छोड़ें"
      >
        {range ? (
          <select
            className={inputClass}
            value={unit}
            onChange={(e) => onUnitChange(e.target.value)}
            disabled={!block}
          >
            <option value="">Select… / चुनें…</option>
            {units.map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            className={inputClass}
            value={unit}
            onChange={(e) => onUnitChange(e.target.value)}
            placeholder={block ? "e.g. 11" : "Choose a block first"}
            disabled={!block}
            maxLength={10}
          />
        )}
      </Field>
    </div>
  );
}
