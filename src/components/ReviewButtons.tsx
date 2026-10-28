"use client";
import { useFormStatus } from "react-dom";

/** Hai nút Duyệt / Từ chối dùng chung một biểu mẫu (name="decision"), có hỏi lại trước khi gửi. */
export function ReviewButtons() {
  const { pending } = useFormStatus();
  const ask = (msg: string) => (e: React.MouseEvent) => { if (!window.confirm(msg)) e.preventDefault(); };
  return (
    <div className="flex flex-wrap gap-3">
      <button type="submit" name="decision" value="approve" disabled={pending}
        onClick={ask("Duyệt yêu cầu này? Thay đổi sẽ được áp dụng ngay vào gia phả.")}
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-wine px-6 py-2 text-base font-semibold text-white hover:bg-wine-dark disabled:opacity-60">
        {pending ? "Đang xử lý…" : "Duyệt"}
      </button>
      <button type="submit" name="decision" value="reject" disabled={pending}
        onClick={ask("Từ chối yêu cầu này?")}
        className="inline-flex min-h-12 items-center justify-center rounded-xl border border-danger px-6 py-2 text-base font-semibold text-danger hover:bg-red-50 disabled:opacity-60">
        Từ chối
      </button>
    </div>
  );
}
