import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  // Mobile-first: comfortable padding on phones, slightly larger on bigger screens
  return <section className={`rounded-2xl border border-champagne/60 bg-ivory p-4 shadow-sm md:p-5 ${className}`}>{children}</section>;
}

export function Alert({ kind, children }: { kind: "error" | "ok"; children: ReactNode }) {
  const style = kind === "error" ? "border-danger text-danger bg-red-50" : "border-ok text-ok bg-green-50";
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-[15px] font-medium ${style}`}>
      {children}
    </p>
  );
}

const fieldBase =
  "mt-1 block w-full min-h-[48px] rounded-xl border border-ink-soft/40 bg-white px-4 py-2.5 text-[15px] text-ink placeholder:text-ink-soft";

export function Field({ label, hint, ...props }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-[15px] font-semibold">
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
    <label className="block text-[15px] font-semibold">
      {label}
      <select {...props} className={fieldBase}>{children}</select>
    </label>
  );
}

export const buttonClass =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-wine px-5 py-2.5 text-[15px] font-semibold text-white active:scale-[0.985] hover:bg-wine-dark disabled:opacity-60 transition";
export const buttonGhostClass =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-wine px-5 py-2.5 text-[15px] font-semibold text-wine active:scale-[0.985] hover:bg-champagne-soft transition";
