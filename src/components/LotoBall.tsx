import type { CSSProperties } from "react";

/**
 * Bong lo to nhieu mau kieu bingo: moi khoang chuc so mot dai mau (1-9 do, 10-19 cam,
 * 20-29 vang, 30-39 xanh la, 40-49 ngoc, 50-59 xanh duong, 60-69 tim, 70-79 hong, 80-90 tim hong),
 * co vet sang bong o tren trai va bong do nhe cho giong bong that.
 */
const BANDS: ReadonlyArray<readonly [string, string]> = [
  ["#fca5a5", "#dc2626"],
  ["#fdba74", "#ea580c"],
  ["#fcd34d", "#b45309"],
  ["#bef264", "#65a30d"],
  ["#5eead4", "#0d9488"],
  ["#93c5fd", "#2563eb"],
  ["#c4b5fd", "#7c3aed"],
  ["#f9a8d4", "#db2777"],
  ["#f0abfc", "#a21caf"],
];

export function lotoBand(n: number): readonly [string, string] {
  return BANDS[Math.min(8, Math.max(0, Math.floor((n - 1) / 10)))];
}

/** Style nen + bong cho mot o/bong chua so n (dung cho o luoi tron va bong lon tuy bien). */
export function lotoBallStyle(n: number): CSSProperties {
  const [light, dark] = lotoBand(n);
  return {
    background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.22) 34%, rgba(255,255,255,0) 56%), linear-gradient(160deg, ${light} 0%, ${dark} 80%)`,
    boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.28), inset 0 2px 3px rgba(255,255,255,0.45), 0 3px 6px rgba(0,0,0,0.22)",
    textShadow: "0 1px 2px rgba(0,0,0,0.45)",
  };
}

/** Style "con dau do" danh dau so da trung tren to lo to cua nguoi choi. */
export const LOTO_HIT_STYLE: CSSProperties = {
  background: "radial-gradient(circle at 34% 30%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.18) 36%, rgba(255,255,255,0) 58%), linear-gradient(160deg, #f87171 0%, #b91c1c 82%)",
  boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.3), inset 0 2px 3px rgba(255,255,255,0.4), 0 2px 5px rgba(0,0,0,0.25)",
  textShadow: "0 1px 2px rgba(0,0,0,0.4)",
};

/** Bong lo to kich thuoc co dinh (so vua ho, cac so gan day, trang tri sanh). */
export function LotoBall({ n, size = 40, className = "" }: { n: number; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-black text-white ${className}`}
      style={{ ...lotoBallStyle(n), width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.44)) }}
    >
      {n}
    </span>
  );
}
