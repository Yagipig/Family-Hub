"use client";
import { useState, type InputHTMLAttributes } from "react";

// O mat khau co nut con mat de xem/an tam thoi khi go (gop y cua nguoi dung 29/10/2026).
// Dung o dang nhap va dang ky; trang tri khop het Field trong components/ui.

const fieldBase =
  "mt-1 block w-full min-h-12 rounded-xl border border-ink-soft/40 bg-white px-4 py-2 pr-12 text-base text-ink";

function EyeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.73 5.08a10.74 10.74 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-3.39 3.83" />
      <path d="M6.61 6.61A10.73 10.73 0 0 0 2.07 11.65a1 1 0 0 0 0 .7 10.75 10.75 0 0 0 11.24 5.83" />
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function PasswordField({ label, hint, ...props }: { label: string; hint?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <label className="block text-base font-semibold">
      {label}
      <span className="relative block">
        <input {...props} type={show ? "text" : "password"} className={fieldBase} />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-soft hover:text-ink"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </span>
      {hint && <span className="mt-1 block text-sm font-normal text-ink-soft">{hint}</span>}
    </label>
  );
}
