"use client";
import type { QueueItem } from "@/lib/image-client";

const LABEL: Record<QueueItem["status"], string> = {
  queued: "Đang chờ", preparing: "Đang thu nhỏ ảnh…", uploading: "Đang tải lên…", done: "Xong", error: "Lỗi",
};

/** Danh sách tiến độ tải ảnh (đọc được bằng trình đọc màn hình: role=progressbar cho từng ảnh). */
export function UploadProgress({ items }: { items: QueueItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul aria-live="polite" className="space-y-2">
      {items.map((it) => (
        <li key={it.key} className="rounded-xl border border-champagne/60 bg-white p-3">
          <div className="flex items-center justify-between gap-3 text-base">
            <span className="min-w-0 truncate font-medium">{it.name}</span>
            <span className={it.status === "error" ? "font-semibold text-danger" : it.status === "done" ? "font-semibold text-ok" : "text-ink-soft"}>
              {LABEL[it.status]}
            </span>
          </div>
          {it.status !== "error" && (
            <div role="progressbar" aria-label={`Tiến độ ${it.name}`} aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.round(it.progress * 100)} className="mt-2 h-3 overflow-hidden rounded-full bg-champagne-soft">
              <div className="h-full rounded-full bg-wine transition-all" style={{ width: `${Math.round(it.progress * 100)}%` }} />
            </div>
          )}
          {it.error && <p className="mt-2 text-base text-danger">{it.error}</p>}
        </li>
      ))}
    </ul>
  );
}
