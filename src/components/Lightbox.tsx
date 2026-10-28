"use client";
import { useCallback, useEffect, useRef } from "react";

export type LightboxItem = { id: string; src: string; caption?: string | null; alt?: string };

/**
 * Xem ảnh phóng to: phím ← → Esc, vuốt ngang trên điện thoại, nút lớn, nạp trước ảnh kế bên.
 * `children` hiển thị dưới ảnh (chú thích, nút sửa/xóa...). Đặt role=dialog + aria-modal, trả lại tiêu điểm khi đóng.
 */
export function Lightbox({
  items, index, onClose, onChange, children,
}: {
  items: LightboxItem[]; index: number | null; onClose: () => void; onChange: (i: number) => void; children?: React.ReactNode;
}) {
  const open = index !== null && index >= 0 && index < items.length;
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const idx = open ? index : 0;

  const go = useCallback((d: number) => {
    if (items.length === 0) return;
    onChange((idx + d + items.length) % items.length);
  }, [idx, items.length, onChange]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (!typing && e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (!typing && e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "Tab" && dialogRef.current) {
        const f = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])"))
          .filter((el) => !el.hasAttribute("disabled"));
        if (f.length === 0) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go, onClose]);

  // Nạp trước ảnh kế bên cho mượt
  useEffect(() => {
    if (!open || items.length < 2) return;
    for (const d of [-1, 1]) {
      const img = new Image();
      img.src = items[(idx + d + items.length) % items.length].src;
    }
  }, [open, idx, items]);

  if (!open) return null;
  const item = items[idx];
  const navBtn = "absolute top-1/2 z-10 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-3xl text-white hover:bg-black/80";
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Xem ảnh ${idx + 1} trên ${items.length}`}
      className="fixed inset-0 z-50 flex flex-col bg-black/92">
      <div className="flex items-center justify-between px-4 py-2 text-white">
        <span className="text-base" aria-live="polite">{idx + 1} / {items.length}</span>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Đóng"
          className="flex h-12 min-w-12 items-center justify-center rounded-full bg-black/60 px-4 text-base font-semibold hover:bg-black/80">Đóng ✕</button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center"
        onTouchStart={(e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; }}
        onTouchEnd={(e) => {
          const s = touch.current; touch.current = null;
          if (!s) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - s.x, dy = t.clientY - s.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        }}>
        {items.length > 1 && <button type="button" aria-label="Ảnh trước" onClick={() => go(-1)} className={`${navBtn} left-2`}>‹</button>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={item.id} src={item.src} alt={item.alt ?? item.caption ?? "Ảnh"} decoding="async" className="max-h-full max-w-full select-none object-contain" draggable={false} />
        {items.length > 1 && <button type="button" aria-label="Ảnh sau" onClick={() => go(1)} className={`${navBtn} right-2`}>›</button>}
      </div>
      <div className="max-h-[40vh] overflow-y-auto bg-ivory px-4 py-3 text-ink">
        {item.caption && <p className="text-lg font-medium">{item.caption}</p>}
        {children}
      </div>
    </div>
  );
}
