import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-champagne/60 bg-ivory p-6 shadow-sm ${className}`}>{children}</section>;
}

export function Alert({ kind, children }: { kind: "error" | "ok"; children: ReactNode }) {
  const style = kind === "error" ? "border-danger text-danger bg-red-50" : "border-ok text-ok bg-green-50";
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-base font-medium ${style}`}>
      {children}
    </p>
  );
}

const fieldBase =
  "mt-1 block w-full min-h-12 rounded-xl border border-ink-soft/40 bg-white px-4 py-2 text-base text-ink";

export function Field({ label, hint, ...props }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-base font-semibold">
      {label}
      <input {...props} className={fieldBase} />
      {hint && <span className="mt-1 block text-sm font-normal text-ink-soft">{hint}</span>}
    </label>
  );
}

export function SelectField({
  label, children, ...props
}: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block text-base font-semibold">
      {label}
      <select {...props} className={fieldBase}>{children}</select>
    </label>
  );
}

export const buttonClass =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-wine px-6 py-2 text-base font-semibold text-white hover:bg-wine-dark disabled:opacity-60";
export const buttonGhostClass =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-wine px-5 py-2 text-base font-semibold text-wine hover:bg-champagne-soft";
