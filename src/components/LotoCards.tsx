"use client";
import { useEffect, useMemo, useState } from "react";
import { lotoRows } from "@/lib/games/loto";
import { LOTO_HIT_STYLE } from "@/components/LotoBall";

type Card = { id: string; cardNo: number; grid: number[]; boardLabel?: string };

/** Khung to lo to ruc ro kieu bingo: moi to mot dai gradient, giay trang ben trong. */
const FRAME_GRADIENTS = [
  "linear-gradient(150deg, #7c3aed 0%, #db2777 100%)",
  "linear-gradient(150deg, #2563eb 0%, #06b6d4 100%)",
  "linear-gradient(150deg, #ea580c 0%, #dc2626 100%)",
  "linear-gradient(150deg, #059669 0%, #65a30d 100%)",
  "linear-gradient(150deg, #d97706 0%, #db2777 100%)",
];
const WINNER_GRADIENT = "linear-gradient(150deg, #f59e0b 0%, #facc15 55%, #d97706 100%)";

/**
 * Cac to lo to cua toi, trinh bay kieu the bingo: so trung duoc dong "con dau do" bong.
 * Danh dau o chi la tien ich hien thi: "kinh" do MAY CHU kiem tra bang cac so da ho that.
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
        const frame = isWinner ? WINNER_GRADIENT : FRAME_GRADIENTS[(c.cardNo - 1) % FRAME_GRADIENTS.length];
        return (
          <div key={c.id} className="rounded-[24px] p-2 shadow-xl" style={{ background: frame }}>
            <div className="rounded-[18px] bg-[#fffdf6] p-2.5 sm:p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                <p className="text-lg font-black tracking-wide text-[#571c10]">🎲 {c.boardLabel ?? `Tờ ${c.cardNo}`}</p>
                {isWinner ? (
                  <span className="rounded-full bg-wine px-3 py-1 text-sm font-black text-white">🏆 TỜ CHIẾN THẮNG</span>
                ) : ready && playing ? (
                  <span className="motion-safe:animate-pulse rounded-full bg-red-600 px-3 py-1 text-sm font-black text-white">ĐÃ ĐỦ HÀNG — KINH ĐI!</span>
                ) : null}
              </div>
              <div role="grid" aria-label={`Tờ lô tô số ${c.cardNo}`} className="grid grid-cols-9 gap-1 sm:gap-1.5">
                {[0, 1, 2].flatMap((r) =>
                  Array.from({ length: 9 }, (_, col) => {
                    const v = c.grid[r * 9 + col];
                    if (v === 0) return <div key={`${r}-${col}`} role="gridcell" aria-hidden className="aspect-square rounded-lg bg-purple-200/40" />;
                    const marked = shown.has(v);
                    const rowFull = full[r];
                    return (
                      <button
                        key={`${r}-${col}`}
                        type="button"
                        role="gridcell"
                        disabled={auto}
                        aria-pressed={marked}
                        aria-label={`Số ${v}${marked ? ", đã đánh dấu" : ""}`}
                        onClick={() => toggle(v)}
                        className={`flex aspect-square min-h-11 items-center justify-center rounded-full text-lg font-black sm:text-xl ${
                          marked ? "text-white" : "bg-white text-ink shadow-sm ring-1 ring-[#e7ddc8]"
                        } ${rowFull && marked ? "ring-[3px] ring-amber-400" : ""} ${auto ? "cursor-default" : "hover:ring-2 hover:ring-red-400"}`}
                        style={marked ? LOTO_HIT_STYLE : undefined}
                      >
                        {v}
                      </button>
                    );
                  }),
                )}
              </div>
              {playing && (
                <form action={claimAction} className="mt-3 flex flex-wrap items-center gap-3 px-1 pb-1">
                  <input type="hidden" name="roomId" value={roomId} />
                  <input type="hidden" name="cardId" value={c.id} />
                  <button
                    className={`inline-flex min-h-16 items-center justify-center rounded-full px-10 py-2 text-2xl font-black tracking-wide transition-transform active:translate-y-1 ${
                      ready
                        ? "motion-safe:animate-pulse bg-[linear-gradient(180deg,#fde047,#f59e0b)] text-[#571c10] shadow-[0_6px_0_#b45309,0_12px_20px_rgba(0,0,0,0.25)]"
                        : "bg-[linear-gradient(180deg,#e7e5e4,#a8a29e)] text-stone-600 shadow-[0_6px_0_#78716c]"
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
          </div>
        );
      })}
    </div>
  );
}
