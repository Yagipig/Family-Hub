"use client";
import { useEffect, useRef, useState } from "react";

const ON_KEY = "fh-loto-music";
const VOL_KEY = "fh-loto-music-vol";

/**
 * Nhac nen lo to (duong dan tep nhac do admin dat). Tu giam am luong xuong 25% khi giong ho dang doc
 * (su kien "fh-loto-speak" tu loto-voice), het doc thi tra lai sau 0,4 giay.
 */
export function LotoMusic({ url, dark = false }: { url: string | null; dark?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const duckTimer = useRef<number | null>(null);
  const [on, setOn] = useState(false);
  const [vol, setVol] = useState(0.5);

  useEffect(() => {
    try {
      setOn(window.localStorage.getItem(ON_KEY) === "1");
      const v = Number(window.localStorage.getItem(VOL_KEY));
      if (v > 0 && v <= 1) setVol(v);
    } catch { /* bo qua */ }
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !url) return;
    a.volume = vol;
    if (on) { a.play().catch(() => { /* trinh duyet chan autoplay: cho nguoi dung bam lai */ }); }
    else a.pause();
  }, [on, url, vol]);

  useEffect(() => {
    const handler = (e: Event) => {
      const a = audioRef.current;
      if (!a) return;
      const speaking = (e as CustomEvent<{ on: boolean }>).detail?.on;
      if (duckTimer.current) { window.clearTimeout(duckTimer.current); duckTimer.current = null; }
      if (speaking) a.volume = vol * 0.25;
      else duckTimer.current = window.setTimeout(() => { if (audioRef.current) audioRef.current.volume = vol; }, 400);
    };
    window.addEventListener("fh-loto-speak", handler);
    return () => window.removeEventListener("fh-loto-speak", handler);
  }, [vol]);

  if (!url) return null;
  const btn = dark
    ? "inline-flex min-h-12 items-center rounded-xl border border-champagne px-4 py-2 text-base font-semibold text-champagne"
    : "inline-flex min-h-12 items-center rounded-xl border border-wine px-4 py-2 text-base font-semibold text-wine hover:bg-champagne-soft";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <audio ref={audioRef} src={url} loop preload="none" />
      <button
        type="button" aria-pressed={on}
        onClick={() => {
          const v = !on;
          setOn(v);
          try { window.localStorage.setItem(ON_KEY, v ? "1" : "0"); } catch { /* bo qua */ }
        }}
        className={btn}
      >
        {on ? "🎵 Nhạc nền: BẬT" : "🎵 Nhạc nền: tắt"}
      </button>
      {on && (
        <label className={`flex items-center gap-2 text-base font-semibold ${dark ? "text-champagne" : ""}`}>
          Âm lượng nhạc
          <input
            type="range" min={0.1} max={1} step={0.05} value={vol} aria-label="Âm lượng nhạc nền"
            onChange={(e) => {
              const v = Number(e.target.value);
              setVol(v);
              try { window.localStorage.setItem(VOL_KEY, String(v)); } catch { /* bo qua */ }
            }}
            className="w-32"
          />
        </label>
      )}
    </div>
  );
}
