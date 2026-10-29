"use client";
import { useMemo, useState } from "react";
import { isValidLotoCard, relayoutLotoCard } from "@/lib/games/loto";
import { LotoGridView } from "@/components/LotoGridView";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonClass } from "@/components/ui";
import { boardRandomGrid, boardRestore, boardUpdate } from "@/app/(app)/admin/tro-choi/bang-lo-to/actions";

function randBelow(k: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % k;
}

/**
 * Trinh sua mot bang tinh: xem truoc thay doi truoc khi luu.
 * - "Dao bo so moi": xin bo so hop le moi tu may chu (chua luu).
 * - "Xep lai bo cuc": giu nguyen dung 15 con so, chi doi hang cua so (lam o trinh duyet, chua luu).
 * - "Luu bang nay": may chu kiem tra lai + ghi lich su. "Khoi phuc ban truoc": doi cho voi lich su.
 */
export function BoardEditor({ code, name, savedGrid, historyCount }: {
  code: string; name: string; savedGrid: number[]; historyCount: number;
}) {
  const [grid, setGrid] = useState<number[]>(savedGrid);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = useMemo(() => isValidLotoCard(grid), [grid]);
  const dirty = useMemo(() => JSON.stringify(grid) !== JSON.stringify(savedGrid), [grid, savedGrid]);
  const numbers = useMemo(() => grid.filter((v) => v !== 0).sort((a, b) => a - b), [grid]);

  async function randomize() {
    setBusy(true); setMsg(null);
    const r = await boardRandomGrid();
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
    setGrid(r.grid);
    setMsg("Đã sinh bộ số mới (chưa lưu). Xem trước bên dưới, ưng ý thì bấm Lưu bảng này.");
  }

  function relayout() {
    setMsg(null);
    const out = relayoutLotoCard(grid, randBelow);
    if (!out) { setMsg("Chưa xếp lại được lần này, bạn thử lại nhé."); return; }
    setGrid(out);
    setMsg("Đã xếp lại bố cục, vẫn giữ nguyên 15 con số (chưa lưu).");
  }

  const btn = "inline-flex min-h-12 items-center justify-center rounded-xl px-4 py-2 text-base font-semibold";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold">{name} · {code}</h3>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${valid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
          {valid ? "Bảng hợp lệ ✓" : "Bảng CHƯA hợp lệ ✗"}
        </span>
        {dirty && <span className="rounded-full bg-champagne px-3 py-1 text-sm font-bold text-wine-dark">Có thay đổi chưa lưu</span>}
      </div>
      <div className="max-w-xl"><LotoGridView grid={grid} /></div>
      <p className="text-base text-ink-soft">15 số của bảng: {numbers.join(", ")}</p>
      {msg && <p className="rounded-xl bg-champagne-soft px-4 py-2 text-base font-semibold">{msg}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={() => void randomize()} className={`${btn} bg-wine text-white hover:bg-wine-dark disabled:opacity-50`}>🎲 Đảo bộ số mới</button>
        <button type="button" disabled={busy || !valid} onClick={relayout} className={`${btn} border-2 border-wine text-wine disabled:opacity-50`}>🔀 Xếp lại bố cục (giữ nguyên số)</button>
        <button type="button" disabled={!dirty} onClick={() => { setGrid(savedGrid); setMsg(null); }} className={`${btn} border border-ink-soft/40 text-ink-soft disabled:opacity-50`}>Hoàn về bản đã lưu</button>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-champagne/60 pt-3">
        <form action={boardUpdate}>
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="grid" value={JSON.stringify(grid)} />
          {dirty && valid ? (
            <SubmitButton>Lưu bảng này</SubmitButton>
          ) : (
            <button type="button" disabled className={`${buttonClass} opacity-50`}>Lưu bảng này</button>
          )}
        </form>
        <form action={boardRestore}>
          <input type="hidden" name="code" value={code} />
          <button disabled={historyCount === 0} className={`${btn} border border-ink-soft/40 text-ink disabled:opacity-50`}>
            ↩ Khôi phục bản trước {historyCount > 0 ? `(${historyCount} bản trong lịch sử)` : "(chưa có lịch sử)"}
          </button>
        </form>
      </div>
      <p className="text-sm text-ink-soft">
        Lưu ý: thay đổi chỉ áp dụng cho các ván sau. Bảng người chơi đã chọn trong phòng đang chờ/đang chơi giữ nguyên như lúc họ chọn.
      </p>
    </div>
  );
}
