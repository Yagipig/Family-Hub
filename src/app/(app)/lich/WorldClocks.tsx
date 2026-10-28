"use client";
import { useEffect, useState } from "react";

export type ClockInfo = { countryName: string; timezone: string; names: string[]; count: number };

function fmt(now: Date, tz: string) {
  try {
    const time = new Intl.DateTimeFormat("vi-VN", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
    const day = new Intl.DateTimeFormat("vi-VN", { timeZone: tz, weekday: "long", day: "2-digit", month: "2-digit" }).format(now);
    return { time, day };
  } catch {
    return { time: "--:--", day: "" };
  }
}

/** Đồng hồ giờ hiện tại ở nơi người thân sinh sống. Chạy ở trình duyệt, cập nhật mỗi 30 giây; chưa chạy thì hiện "--:--". */
export function WorldClocks({ clocks, homeTz, homeLabel }: { clocks: ClockInfo[]; homeTz: string; homeLabel: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const all = [{ countryName: homeLabel, timezone: homeTz, names: [], count: 0, home: true }, ...clocks.map((c) => ({ ...c, home: false }))];
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Đồng hồ các nơi">
      {all.map((c) => {
        const f = now ? fmt(now, c.timezone) : { time: "--:--", day: "" };
        return (
          <li key={`${c.countryName}|${c.timezone}|${c.home}`} className="rounded-xl border border-champagne/60 bg-white px-4 py-3">
            <p className="text-base font-semibold">{c.home ? `Chỗ bạn (${c.countryName})` : `Bây giờ ở ${c.countryName} là`}</p>
            <p className="text-3xl font-bold text-wine" aria-live="off">{f.time}</p>
            <p className="text-sm text-ink-soft">{f.day}</p>
            {!c.home && (
              <p className="text-sm text-ink-soft">
                {c.names.length > 0 ? c.names.join(", ") + (c.count > c.names.length ? ` và ${c.count - c.names.length} người khác` : "") : `${c.count} người`}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
