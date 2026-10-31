"use client";
import { useMemo } from "react";

// RNG co seed co dinh de ban render tren may chu va trinh duyet giong het nhau (khong lech hydration)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hieu ung hoa anh dao roi cho trang chu (nguoi dung yeu cau 31/10/2026):
 * canh hoa hong roi cham, lac ngang nhu theo gio. Chi trang tri: khong chan cham/click,
 * nam duoi thanh dieu huong, va tu tat khi thiet bi chon "giam chuyen dong" (CSS).
 */
export function SakuraPetals({ count = 14 }: { count?: number }) {
  const petals = useMemo(() => {
    const rand = mulberry32(20261031);
    return Array.from({ length: count }, (_, i) => {
      const size = 9 + rand() * 9; // 9-18px
      return {
        key: i,
        flip: rand() < 0.5,
        style: {
          left: `${(rand() * 100).toFixed(2)}%`,
          width: `${size.toFixed(1)}px`,
          height: `${(size * 0.82).toFixed(1)}px`,
          animationDuration: `${(10 + rand() * 9).toFixed(2)}s`,
          animationDelay: `${(-rand() * 18).toFixed(2)}s`,
          opacity: 0.55 + rand() * 0.4,
        } as React.CSSProperties,
      };
    });
  }, [count]);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {petals.map((p) => (
        <span key={p.key} className={`sakura-petal${p.flip ? " flip" : ""}`} style={p.style} />
      ))}
    </div>
  );
}
