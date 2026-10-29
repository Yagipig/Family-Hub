"use client";

/** Bang 1..90: so da ho to dam; so vua ho to nhat. Giong ho nam o LotoAnnouncer. */
export function LotoBoard({ called, last }: { called: number[]; last: number | null }) {
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
