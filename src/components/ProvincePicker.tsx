"use client";
import { useMemo, useState } from "react";
import { LOTO63_VIEWBOX, PROVINCES63, type Province63 } from "@/lib/games/provinces63";
import { LotoGridView } from "@/components/LotoGridView";
import { SubmitButton } from "@/components/SubmitButton";

export type BoardTaken = { name: string; mine: boolean };

const REGIONS: Array<{ key: Province63["region"]; label: string }> = [
  { key: "bac", label: "Miền Bắc" },
  { key: "trung", label: "Miền Trung" },
  { key: "nam", label: "Miền Nam" },
];

function regionViewBox(region: Province63["region"]): string {
  const ps = PROVINCES63.filter((p) => p.region === region);
  const xs = ps.map((p) => p.cx), ys = ps.map((p) => p.cy);
  const pad = 170;
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2, h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  return `${x} ${y} ${w} ${h}`;
}

/**
 * Ban do 63 tinh/thanh cu de chon bang lo to: tinh con trong (sang), da co nguoi (dam + ten nguoi),
 * bang cua minh (do vang). Bam vao tinh de xem truoc bang; co nut phong/thu va nhay theo mien.
 * Danh sach the tinh o duoi la duong chon du phong cho cac tinh nho tren ban do.
 */
export function ProvincePicker({
  roomId, grids, taken, claimAction,
}: {
  roomId: string;
  grids: Record<string, number[]>;
  taken: Record<string, BoardTaken>;
  claimAction: (fd: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState(LOTO63_VIEWBOX);
  const sel = useMemo(() => PROVINCES63.find((p) => p.code === selected) ?? null, [selected]);
  const selTaken = sel ? taken[sel.code] : undefined;

  function zoom(factor: number) {
    const [x, y, w, h] = viewBox.split(/\s+/).map(Number);
    const nw = Math.max(180, Math.min(1400, w * factor));
    const nh = h * (nw / w);
    setViewBox(`${x + (w - nw) / 2} ${y + (h - nh) / 2} ${nw} ${nh}`);
  }

  const zoomBtn = "inline-flex min-h-11 items-center rounded-xl border border-wine px-3 py-1 text-base font-semibold text-wine hover:bg-champagne-soft";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={zoomBtn} onClick={() => setViewBox(LOTO63_VIEWBOX)}>Cả nước</button>
        {REGIONS.map((r) => (
          <button key={r.key} type="button" className={zoomBtn} onClick={() => setViewBox(regionViewBox(r.key))}>{r.label}</button>
        ))}
        <span className="mx-1 text-ink-soft">|</span>
        <button type="button" className={zoomBtn} aria-label="Phóng to" onClick={() => zoom(0.65)}>＋</button>
        <button type="button" className={zoomBtn} aria-label="Thu nhỏ" onClick={() => zoom(1.5)}>－</button>
      </div>

      <svg viewBox={viewBox} role="group" aria-label="Bản đồ 63 tỉnh thành" className="w-full rounded-2xl border border-champagne/70 bg-[#fdf6e3] transition-all duration-300" style={{ maxHeight: "70vh" }}>
        {PROVINCES63.map((p) => {
          const t = taken[p.code];
          const isSel = selected === p.code;
          return (
            <path
              key={p.code}
              d={p.path}
              onClick={() => setSelected(p.code)}
              className="cursor-pointer"
              style={{
                fill: t?.mine ? "#7f1d2d" : t ? "#d9c69a" : "#fffdf5",
                stroke: isSel ? "#7f1d2d" : "#b08d57",
                strokeWidth: isSel ? 4 : 1.1,
              }}
            >
              <title>{p.name} — {t ? (t.mine ? "bảng của bạn" : `đã có người chọn: ${t.name}`) : "còn trống"}</title>
            </path>
          );
        })}
        {PROVINCES63.filter((p) => taken[p.code] || selected === p.code).map((p) => (
          <text key={`t-${p.code}`} x={p.cx} y={p.cy} textAnchor="middle" pointerEvents="none"
            style={{ fontSize: 23, fontWeight: 700, fill: taken[p.code]?.mine ? "#ffffff" : "#4a3520", paintOrder: "stroke", stroke: "#fdf6e3", strokeWidth: 3 }}>
            {p.name}
          </text>
        ))}
      </svg>
      <p className="text-sm text-ink-soft">Ranh giới 63 tỉnh/thành trước năm 2025 · dữ liệu: Tổng cục Thống kê (qua dvhcvn), đã đơn giản hóa.</p>

      {sel && (
        <div className="space-y-3 rounded-2xl border-2 border-champagne bg-ivory p-4">
          <p className="text-xl font-bold text-wine">
            {sel.name} <span className="text-base font-semibold text-ink-soft">· Bảng {sel.code}</span>
          </p>
          {selTaken ? (
            <p className="text-lg font-semibold">{selTaken.mine ? "Đây là bảng của bạn." : `Đã có người chọn: ${selTaken.name}`}</p>
          ) : (
            <>
              {grids[sel.code] && <LotoGridView grid={grids[sel.code]} compact />}
              <form action={claimAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="roomId" value={roomId} />
                <input type="hidden" name="code" value={sel.code} />
                <SubmitButton pendingText="Đang khóa bảng…">Chọn bảng này</SubmitButton>
                <span className="text-sm text-ink-soft">Chọn xong bảng sẽ khóa cho bạn; người khác không chọn lại được.</span>
              </form>
            </>
          )}
          {selTaken && grids[sel.code] && <LotoGridView grid={grids[sel.code]} compact />}
        </div>
      )}

      {REGIONS.map((r) => (
        <div key={r.key} className="space-y-2">
          <h3 className="text-lg font-bold">{r.label}</h3>
          <div className="flex flex-wrap gap-2">
            {PROVINCES63.filter((p) => p.region === r.key).map((p) => {
              const t = taken[p.code];
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => { setSelected(p.code); setViewBox(regionViewBox(r.key)); }}
                  className={`min-h-11 rounded-xl border px-3 py-1 text-base font-semibold ${
                    t?.mine ? "border-wine bg-wine text-white"
                    : t ? "border-champagne bg-champagne-soft text-ink-soft"
                    : selected === p.code ? "border-wine bg-champagne-soft text-wine"
                    : "border-champagne/70 bg-ivory text-ink hover:border-wine"
                  }`}
                >
                  {p.name}{t ? ` · ${t.mine ? "của bạn" : t.name}` : ""}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
