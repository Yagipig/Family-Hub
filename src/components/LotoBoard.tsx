"use client";
import { LotoBall, lotoBallStyle } from "@/components/LotoBall";

/**
 * San lo to kieu bingo: nen tim ruc, bong vua ho LON nay vao giua san,
 * day bong vua ho gan day, va bang 90 o — so da ho sang len thanh bong mau theo chuc so.
 * Giong ho nam o LotoAnnouncer.
 */
export function LotoBoard({ called, last }: { called: number[]; last: number | null }) {
  const set = new Set(called);
  const recent = [...called].slice(-8).reverse();
  return (
    <div
      className="space-y-4 rounded-3xl p-4 shadow-lg sm:p-5"
      style={{ background: "linear-gradient(155deg, #4c1d95 0%, #7c3aed 52%, #a21caf 100%)" }}
    >
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex flex-col items-center gap-1.5">
          {last != null ? (
            <span key={last} className="animate-loto-pop inline-flex rounded-full ring-4 ring-yellow-300/90">
              <LotoBall n={last} size={104} />
            </span>
          ) : (
            <span className="inline-flex h-[104px] w-[104px] items-center justify-center rounded-full bg-white/15 text-5xl font-black text-white/70">–</span>
          )}
          <span role="status" aria-live="polite" className="text-sm font-bold uppercase tracking-widest text-white/85">
            {last != null ? `Số vừa hô: ${last}` : "Số vừa hô"}
          </span>
        </div>
        <div className="min-w-44 flex-1 space-y-2">
          <p className="text-lg font-bold text-white">Đã hô {called.length}/90 số</p>
          {recent.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-white/75">Vừa hô gần đây</p>
              <ol className="flex flex-wrap gap-1.5" aria-label="Các số vừa hô gần đây">
                {recent.map((n, i) => (
                  <li key={`${n}-${i}`} className={i === 0 ? "animate-loto-pop" : undefined}>
                    <LotoBall n={n} size={38} />
                  </li>
                ))}
              </ol>
            </div>
          )}
          <p className="text-sm text-white/70">Số đã hô sáng bóng màu ở bảng dưới — mỗi khoảng chục số một màu.</p>
        </div>
      </div>
      <ol className="grid grid-cols-10 gap-1 sm:gap-1.5" aria-label="Bảng 90 số">
        {Array.from({ length: 90 }, (_, i) => i + 1).map((n) =>
          set.has(n) ? (
            <li
              key={n}
              aria-label={`Số ${n}, đã hô`}
              style={lotoBallStyle(n)}
              className={`flex aspect-square items-center justify-center rounded-full text-sm font-black text-white sm:text-base ${
                n === last ? "ring-4 ring-yellow-300" : ""
              }`}
            >
              {n}
            </li>
          ) : (
            <li
              key={n}
              className="flex aspect-square items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white/40 ring-1 ring-white/15 sm:text-base"
            >
              {n}
            </li>
          ),
        )}
      </ol>
    </div>
  );
}
