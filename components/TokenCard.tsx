"use client";

import { useState } from "react";
import { Copy, Check, Printer } from "lucide-react";

/**
 * The token, shown big.
 *
 * This is what the resident has to produce at the door, so it is sized to be
 * readable on a cracked phone screen at arm's length, spaced in groups, and
 * copyable and printable — a resident with no data plan can take it to the
 * town office on paper.
 */
export function TokenCard({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked over plain http and in some in-app browsers.
      // The token is selectable on screen, so this is not worth an error.
    }
  }

  return (
    <div className="rounded-card border-2 border-primary bg-primary-soft p-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
        Your token
      </p>
      <p className="hi text-xs text-primary">आपका टोकन</p>

      <p className="mt-3 select-all break-all font-mono text-2xl font-bold tracking-widest text-primary sm:text-3xl">
        {token}
      </p>

      <p className="mt-3 text-sm text-text">
        Show this token to the person who comes to fix the problem.
      </p>
      <p className="hi text-sm text-text">
        जो व्यक्ति समस्या ठीक करने आए, उसे यह टोकन दिखाएं।
      </p>

      <div className="mt-4 flex flex-wrap justify-center gap-2 no-print">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 rounded-lg border border-primary bg-surface px-4 py-2 text-sm font-semibold text-primary"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg border border-primary bg-surface px-4 py-2 text-sm font-semibold text-primary"
        >
          <Printer size={16} />
          Print
        </button>
      </div>
    </div>
  );
}
