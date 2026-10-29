"use client";
import { useEffect, useMemo, useState } from "react";
import { lotoRows } from "@/lib/games/loto";

type Card = { id: string; cardNo: number; grid: number[]; boardLabel?: string };

/**
 * Cac to lo to cua toi. Danh dau o chi la tien ich hien thi: "kinh" do MAY CHU kiem tra bang cac so da ho that.
 * Che do tu dong danh dau (mac dinh BAT) hoac tu bam vao tung o.
 */
export function LotoCards({
  roomId, cards, called, playing, winnerCardId, claimAction, winRows = 1,
}: {
  roomId: string;
  cards: Card[];
  called: number[];
  playing: boolean;
  winnerCardId?: string | null;
  claimAction: (fd: FormData) => Promise<void>;
  winRows?: number;
}) {
  const storeKey = `fh-loto-marks-${roomId}`;
  const [auto, setAuto] = useState(true);
  const [marks, setMarks] = useState<Set<number>>(new Set());
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(storeKey);
      if (raw) setMarks(new Set(JSON.parse(raw) as number[]));
    } catch { /* bo qua */ }
  }, [storeKey]);
  const toggle = (n: number) => {
    setMarks((m) => {
      const next = new Set(m);
      if (next.has(n)) next.delete(n); else next.add(n);
      try { window.sessionStorage.setItem(storeKey, JSON.stringify([...next])); } catch { /* bo qua */ }
      return next;
    });
  };
  const calledSet = useMemo(() => new Set(called), [called]);
  const shown = auto ? calledSet : marks;

  return (
    <div className="space-y-6">
      <label className="flex min-h-12 items-center gap-3 text-base font-semibold">
        <input type="checkbox" className="h-6 w-6" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        Tự động đánh dấu số đã hô
      </label>
      {cards.map((c) => {
        const rows = lotoRows(c.grid);
        const full = rows.map((r) => r.every((v) => shown.has(v)));
        const fullCount = full.filter(Boolean).length;
        const ready = fullCount >= winRows;
        const isWinner = winnerCardId === c.id;
        return (
          <div key={c.id} className={`rounded-2xl border-2 p-3 ${isWinner ? "border-wine bg-champagne-soft" : "border-champagne/70 bg-ivory"}`}>
            <p className="mb-2 text-base font-bold">{c.boardLabel ?? `Tờ ${c.cardNo}`}{isWinner ? " — tờ chiến thắng" : ""}</p>
            <div role="grid" aria-label={`Tờ lô tô số ${c.cardNo}`} className="grid grid-cols-9 gap-1">
              {[0, 1, 2].flatMap((r) =>
                Array.from({ length: 9 }, (_, col) => {
                  const v = c.grid[r * 9 + col];
                  if (v === 0) return <div key={`${r}-${col}`} role="gridcell" aria-hidden className="aspect-square rounded-md bg-champagne/30" />;
                  const marked = shown.has(v);
                  return (
                    <button
                      key={`${r}-${col}`}
                      type="button"
                      role="gridcell"
                      disabled={auto}
                      aria-pressed={marked}
                      aria-label={`Số ${v}${marked ? ", đã đánh dấu" : ""}`}
                      onClick={() => toggle(v)}
                      className={`flex aspect-square min-h-11 items-center justify-center rounded-md text-lg font-bold sm:text-xl ${
                        marked ? "bg-wine text-white" : "bg-white text-ink ring-1 ring-ink-soft/30"
                      } ${auto ? "cursor-default" : "hover:ring-2 hover:ring-wine"}`}
                    >
                      {v}
                    </button>
                  );
                }),
              )}
            </div>
            {playing && (
              <form action={claimAction} className="mt-3 flex flex-wrap items-center gap-3">
                <input type="hidden" name="roomId" value={roomId} />
                <input type="hidden" name="cardId" value={c.id} />
                <button
                  className={`inline-flex min-h-14 items-center justify-center rounded-xl px-8 py-2 text-xl font-bold text-white ${
                    ready ? "bg-wine hover:bg-wine-dark motion-safe:animate-pulse" : "bg-ink-soft hover:bg-ink"
                  }`}
                >
                  KINH RỒI NHÉ!
                </button>
                <span className="text-sm text-ink-soft">
                  {ready
                    ? `Đã đủ ${winRows} hàng — bấm KINH RỒI NHÉ! để máy chủ kiểm tra.`
                    : `Cần đủ ${winRows} hàng ngang (mỗi hàng 5 số đã hô) mới kinh được. Kinh sai có thể bị phạt theo cài đặt của quản trị.`}
                </span>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
