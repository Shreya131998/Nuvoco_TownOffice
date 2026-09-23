import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { Tone } from "@/lib/types";

// One source of truth: Tone is declared in lib/types.ts, where STATUS_META and
// OUTCOME_META also use it, and re-exported here so component callers can
// import it alongside the components that take it.
export type { Tone };

const TONE_BADGE: Record<Tone, string> = {
  ok:      "bg-ok-soft text-ok",
  warn:    "bg-warn-soft text-warn",
  danger:  "bg-danger-soft text-danger",
  info:    "bg-info-soft text-info",
  primary: "bg-primary-soft text-primary",
  muted:   "bg-surface-2 text-muted",
};

export function Badge({
  tone = "muted",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        TONE_BADGE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  title,
  subtitle,
  action,
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        // min-w-0 is load-bearing: as a grid/flex item this would otherwise
        // default to min-width:auto and refuse to shrink below its content's
        // intrinsic width, pushing the whole page wider than the phone.
        "min-w-0 rounded-card border border-border bg-surface shadow-sm",
        className
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold sm:text-base">{title}</h2>}
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted sm:text-sm">{subtitle}</p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  // The hint sits on its own line rather than beside the label. Every label
  // here carries Hindi as well as English, and at 320px a bilingual label and
  // a bilingual hint on one baseline row shove each other into three-line
  // wraps that read as one run-on phrase.
  return (
    <label className="block">
      <span className="flex items-baseline gap-1.5 text-sm font-medium">
        {label}
        {required && <span className="text-danger">*</span>}
      </span>
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-sm " +
  "placeholder:text-muted focus:border-primary focus:outline-none " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * `type` defaults to "button", not the HTML default of "submit". Most buttons
 * here drive an onClick handler and several sit next to a text input; with the
 * HTML default, one of them inside a <form> would submit it on Enter. Pass
 * type="submit" explicitly where that is what you want.
 */
export function Button({
  variant = "primary",
  type = "button",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
}) {
  const styles = {
    primary: "bg-primary text-primary-fg hover:opacity-90",
    danger: "bg-danger text-white hover:opacity-90",
    outline: "border border-border-strong bg-surface hover:bg-surface-2",
    ghost: "hover:bg-surface-2",
  }[variant];
  return (
    <button
      type={type}
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold",
        "transition disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className
      )}
    />
  );
}

/** Hindi above, English below — the order drivers read on the paper form. */
export function BiLabel({
  hi,
  en,
  className,
}: {
  hi?: string | null;
  en: string;
  className?: string;
}) {
  return (
    <span className={cn("block leading-tight", className)}>
      {hi && <span className="hi block text-[0.95rem] font-medium">{hi}</span>}
      <span
        className={cn(
          hi ? "block text-xs text-muted" : "block text-[0.95rem] font-medium"
        )}
      >
        {en}
      </span>
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted">{children}</div>
  );
}
