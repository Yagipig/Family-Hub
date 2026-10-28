"use client";
import { useEffect, useState } from "react";

/** Dem nguoc toi thoi diem `to` (ISO). Hien "da het gio" khi qua. Khong dung hoat anh. */
export function Countdown({ to, doneText = "Đã đến giờ" }: { to: string; doneText?: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (now === null) return <span aria-hidden>…</span>;
  const s = Math.max(0, Math.floor((target - now) / 1000));
  if (s === 0) return <span>{doneText}</span>;
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span aria-label={`Còn ${d} ngày ${h} giờ ${m} phút ${sec} giây`}>
      {d > 0 ? `${d} ngày ` : ""}{pad(h)}:{pad(m)}:{pad(sec)}
    </span>
  );
}
