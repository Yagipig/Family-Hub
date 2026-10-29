"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hostCallNext, hostCheckWinners, hostPauseRoom, hostUndoCall } from "@/app/(app)/tro-choi/lo-to/host-actions";
import { SubmitButton } from "@/components/SubmitButton";

const GAP_MS = 2400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ban dieu khien cua CHU PHONG khi van dang dien ra: goi 1 / 3 / 5 so theo chuoi (moi so ghi rieng o may chu,
 * co khoang nghi de nguoi choi do so), tam dung giua chuoi, hoan tac, ket thuc, chuyen quyen chu phong.
 */
export function LotoHostPanel({
  roomId, status, autoWin, calledCount, endAction, resumeAction, transferAction,
}: {
  roomId: string;
  status: "playing" | "paused";
  autoWin: boolean;
  calledCount: number;
  endAction: (fd: FormData) => Promise<void>;
  resumeAction: (fd: FormData) => Promise<void>;
  transferAction: (fd: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [seqLeft, setSeqLeft] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const stopRef = useRef(false);
  const remaining = 90 - calledCount;

  async function callChain(n: number) {
    if (busy || status !== "playing") return;
    stopRef.current = false;
    setBusy(true);
    setMsg(null);
    const want = Math.min(n, remaining);
    if (want < n) setMsg(`Chỉ còn ${remaining} số chưa hô nên gọi ${want} số.`);
    for (let i = 0; i < want; i++) {
      if (stopRef.current) break;
      setSeqLeft(want - i);
      const r = await hostCallNext(roomId);
      if (!r.ok) { setMsg(r.error); break; }
      router.refresh();
      if (autoWin) {
        const w = await hostCheckWinners(roomId);
        if (w.winners > 0) { setMsg(`Có ${w.winners} người KINH! Ván đã kết thúc.`); router.refresh(); break; }
      }
      if (i < want - 1 && !stopRef.current) await sleep(GAP_MS);
    }
    if (stopRef.current) {
      await hostPauseRoom(roomId);
      setMsg("Đã tạm dừng giữa chuỗi gọi. Bấm Tiếp tục khi sẵn sàng.");
      router.refresh();
    }
    setSeqLeft(0);
    setBusy(false);
  }

  async function pauseNow() {
    const r = await hostPauseRoom(roomId);
    if (!r.ok) setMsg(r.error);
    router.refresh();
  }

  async function undo() {
    if (busy) return;
    setBusy(true);
    const r = await hostUndoCall(roomId);
    if (!r.ok) setMsg(r.error);
    setBusy(false);
    router.refresh();
  }

  const btn = "inline-flex min-h-14 items-center justify-center rounded-xl px-6 py-2 text-lg font-bold";
  return (
    <div className="space-y-3">
      <p className="text-base text-ink-soft">
        Đã hô {calledCount}/90 số · còn {remaining} số. {busy && seqLeft > 0 ? `Đang gọi chuỗi… còn ${seqLeft} số trong chuỗi.` : ""}
      </p>
      {msg && <p className="rounded-xl bg-champagne-soft px-4 py-2 text-base font-semibold">{msg}</p>}
      {status === "playing" && (
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => void callChain(1)} className={`${btn} rounded-full bg-[linear-gradient(180deg,#fde047,#f59e0b)] px-8 text-[#571c10] shadow-[0_5px_0_#b45309] transition-transform active:translate-y-0.5 disabled:opacity-50`}>🎲 GỌI 1 SỐ</button>
          <button type="button" disabled={busy} onClick={() => void callChain(3)} className={`${btn} bg-wine text-white hover:bg-wine-dark disabled:opacity-50`}>GỌI LIÊN TIẾP 3 SỐ</button>
          <button type="button" disabled={busy} onClick={() => void callChain(5)} className={`${btn} bg-wine text-white hover:bg-wine-dark disabled:opacity-50`}>GỌI LIÊN TIẾP 5 SỐ</button>
          {busy ? (
            <button type="button" onClick={() => { stopRef.current = true; }} className={`${btn} border-2 border-wine text-wine`}>Dừng + tạm dừng sau số này</button>
          ) : (
            <button type="button" onClick={() => void pauseNow()} className={`${btn} border-2 border-wine text-wine`}>Tạm dừng</button>
          )}
          <button type="button" disabled={busy} onClick={() => void undo()} className={`${btn} border-2 border-ink-soft/50 text-ink disabled:opacity-50`}>Hoàn tác số vừa hô</button>
        </div>
      )}
      {status === "paused" && (
        <div className="flex flex-wrap gap-3">
          <form action={resumeAction}><input type="hidden" name="id" value={roomId} /><SubmitButton>Tiếp tục ván</SubmitButton></form>
          <button type="button" disabled={busy} onClick={() => void undo()} className={`${btn} border-2 border-ink-soft/50 text-ink disabled:opacity-50`}>Hoàn tác số vừa hô</button>
        </div>
      )}
      <div className="flex flex-wrap gap-3 border-t border-champagne/60 pt-3">
        <form action={transferAction}><input type="hidden" name="id" value={roomId} />
          <button className="inline-flex min-h-12 items-center rounded-xl border border-ink-soft/40 px-4 py-2 text-base font-semibold text-ink-soft">Chuyển chủ phòng (ngẫu nhiên)</button>
        </form>
        <form action={endAction}><input type="hidden" name="id" value={roomId} />
          <button className="inline-flex min-h-12 items-center rounded-xl border border-danger/50 px-4 py-2 text-base font-semibold text-danger">Kết thúc ván</button>
        </form>
      </div>
    </div>
  );
}
