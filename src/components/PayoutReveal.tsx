"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import type { RevealResult } from "@/app/(app)/cai-dat/nhan-tien/actions";
import { buttonClass, buttonGhostClass } from "@/components/ui";
import { maskedNumber } from "@/lib/payout";

const AUTO_HIDE_MS = 60_000;

/**
 * Nút che/hiện thông tin nhận tiền. Mặc định CHE (••••1234). Bấm "Hiện" mới gọi máy chủ giải mã (và DB ghi nhật ký);
 * tự ẩn lại sau 60 giây. Bản rõ chỉ nằm trong bộ nhớ của trang, không lưu ở localStorage.
 */
export function PayoutReveal({
  profileId, last4, reveal, who,
}: { profileId: string; last4: string | null; reveal: (id: string) => Promise<RevealResult>; who: "self" | "other" }) {
  const [result, setResult] = useState<RevealResult | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function hide() {
    if (timer.current) clearTimeout(timer.current);
    setResult(null);
  }
  function show() {
    start(async () => {
      const r = await reveal(profileId);
      setResult(r);
      if (r.ok) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setResult(null), AUTO_HIDE_MS);
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-lg">
        Số tài khoản / ID ví: <strong className="font-mono tracking-wider">{maskedNumber(last4)}</strong>
      </p>
      {result?.ok ? (
        <div role="region" aria-label="Thông tin nhận tiền đã hiện" className="space-y-1 rounded-xl border-2 border-wine bg-white p-4 text-lg">
          <p>Chủ tài khoản: <strong>{result.secret.holder}</strong></p>
          <p>Số tài khoản / ID ví: <strong className="font-mono tracking-wider break-all">{result.secret.number}</strong></p>
          {result.secret.note && <p>Ghi chú: {result.secret.note}</p>}
          <p className="pt-1 text-sm text-ink-soft">Tự ẩn sau 1 phút. {who === "other" ? "Lần xem này đã được ghi vào nhật ký." : "Mỗi lần hiện đều được ghi vào nhật ký."}</p>
          <button type="button" className={buttonGhostClass} onClick={hide}>Ẩn lại</button>
        </div>
      ) : (
        <button type="button" className={buttonClass} onClick={show} disabled={pending}>{pending ? "Đang mở…" : "Hiện thông tin đầy đủ"}</button>
      )}
      {result && !result.ok && <p role="alert" className="rounded-xl border border-danger bg-red-50 px-4 py-3 text-base font-medium text-danger">{result.error}</p>}
    </div>
  );
}
