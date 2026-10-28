"use client";
import { useState } from "react";
import { buttonClass } from "@/components/ui";

const MAX = 5 * 1024 * 1024;

/** Biểu mẫu nhập: gửi thẳng (POST multipart) tới route handler; kiểm tra cỡ tệp ngay phía trình duyệt cho nhanh. */
export function ImportForm({ action }: { action: string }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form method="post" action={action} encType="multipart/form-data" className="space-y-4"
      onSubmit={(e) => {
        const f = (e.currentTarget.elements.namedItem("file") as HTMLInputElement | null)?.files?.[0];
        if (f && f.size > MAX) { e.preventDefault(); setMsg("Tệp quá lớn (tối đa 5 MB)."); return; }
        setBusy(true);
      }}>
      <label className="block text-base font-semibold">
        Chọn tệp .json (xuất từ chức năng “Xuất gia phả”)
        <input type="file" name="file" accept=".json,application/json" required
          onChange={(e) => { const f = e.target.files?.[0]; setMsg(f && f.size > MAX ? "Tệp quá lớn (tối đa 5 MB)." : ""); }}
          className="mt-2 block min-h-12 w-full rounded-xl border border-ink-soft/40 bg-white px-4 py-3 text-base" />
      </label>
      {msg && <p role="alert" className="text-base font-medium text-danger">{msg}</p>}
      <label className="flex items-start gap-3 text-base font-semibold">
        <input type="checkbox" name="confirm" required className="mt-1 size-6 shrink-0 accent-wine" />
        <span>Tôi hiểu việc nhập sẽ THÊM thành viên mới (không ghi đè, không xóa dữ liệu hiện có) và đã sao lưu dữ liệu.</span>
      </label>
      <button type="submit" disabled={busy} className={buttonClass}>{busy ? "Đang nhập… vui lòng chờ" : "Nhập gia phả"}</button>
    </form>
  );
}
