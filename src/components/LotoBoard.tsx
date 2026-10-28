"use client";
import { useEffect, useRef, useState } from "react";

const KEY = "fh-games-sound";

function readPref(): boolean {
  try { return window.localStorage.getItem(KEY) === "1"; } catch { return false; }
}
function writePref(on: boolean) {
  try { window.localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* khong luu duoc thi bo qua */ }
}

/** Doc to so vua ho (neu bat am thanh). Mac dinh TAT. */
function announce(n: number) {
  try {
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(`Số ${n}`);
      u.lang = "vi-VN";
      u.rate = 0.85;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return;
    }
    const Ctx = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch { /* trinh duyet khong ho tro am thanh */ }
}

export function SoundToggle({ onChange }: { onChange?: (on: boolean) => void }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const v = readPref(); setOn(v); onChange?.(v); }, [onChange]);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => { const v = !on; setOn(v); writePref(v); onChange?.(v); }}
      className="inline-flex min-h-12 items-center rounded-xl border border-wine px-4 py-2 text-base font-semibold text-wine hover:bg-champagne-soft"
    >
      {on ? "Âm thanh: BẬT (bấm để tắt)" : "Âm thanh: tắt (bấm để bật)"}
    </button>
  );
}

/** Bang 1..90: so da ho to dam; so vua ho to nhat. */
export function LotoBoard({ called, last }: { called: number[]; last: number | null }) {
  const [sound, setSound] = useState(false);
  const prev = useRef<number | null>(last);
  useEffect(() => {
    if (last !== null && last !== prev.current && sound) announce(last);
    prev.current = last;
  }, [last, sound]);
  const set = new Set(called);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div role="status" aria-live="polite" className="flex h-28 w-28 items-center justify-center rounded-full bg-wine text-6xl font-bold text-white motion-safe:transition-transform">
          {last ?? "–"}
        </div>
        <div className="text-base">
          <p className="font-semibold">Số vừa hô</p>
          <p className="text-ink-soft">Đã hô {called.length}/90 số</p>
        </div>
        <SoundToggle onChange={setSound} />
      </div>
      <ol className="grid grid-cols-10 gap-1" aria-label="Bảng 90 số">
        {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => (
          <li
            key={n}
            className={`flex aspect-square items-center justify-center rounded-md text-sm font-semibold sm:text-base ${
              n === last ? "bg-wine-dark text-white ring-2 ring-champagne" : set.has(n) ? "bg-wine text-white" : "bg-champagne-soft text-ink-soft"
            }`}
          >
            {n}
          </li>
        ))}
      </ol>
    </div>
  );
}
