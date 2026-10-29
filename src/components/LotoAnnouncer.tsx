"use client";
import { useEffect, useRef, useState } from "react";
import { callLineFor, randomLine } from "@/lib/games/call-lines";
import { isNearWin } from "@/lib/games/loto";
import { setVoicePrefOn, setVoiceRate, speakLines, stopSpeaking, voicePrefOn, voiceRate } from "@/lib/loto-voice";

/**
 * "Nguoi ho so" tren may cua tung nguoi choi: doc cau ho vui nhon khi co so moi (neu da bat giong),
 * doi khi chen cau trao phung, bao "sap kinh" khi bang cua minh chi con thieu 1 so nua,
 * va chuc mung khi van ket thuc co nguoi thang. Tan suat cau vui + cau rieng do admin cau hinh o may chu.
 */
export function LotoAnnouncer({
  status, last, called, myGrids, winRows, winnerNames, chatter, extraLines,
}: {
  status: "waiting" | "playing" | "paused" | "finished" | "cancelled";
  last: number | null;
  called: number[];
  myGrids: number[][];
  winRows: number;
  winnerNames: string[];
  chatter: number;
  extraLines: string[];
}) {
  const [on, setOn] = useState(false);
  const [rate, setRate] = useState(0.95);
  const prevLast = useRef<number | null>(null);
  const prevStatus = useRef(status);
  const nearWinSaidFor = useRef<number | null>(null);
  const callCount = useRef(0);

  useEffect(() => { setOn(voicePrefOn()); setRate(voiceRate()); }, []);

  // Van bat dau -> cau mo man
  useEffect(() => {
    if (prevStatus.current === "waiting" && status === "playing" && on) speakLines([randomLine("opening")]);
    prevStatus.current = status;
  }, [status, on]);

  // So moi -> cau ho (+ chen trao phung moi ~7 so, + bao sap kinh cho bang cua minh)
  useEffect(() => {
    if (last === null) { prevLast.current = null; return; }
    if (prevLast.current === last) return;
    const isFirstCall = prevLast.current === null;
    prevLast.current = last;
    if (!on || status !== "playing") return;
    const lines = [callLineFor(last, { chatter, extraLines })];
    callCount.current += 1;
    if (!isFirstCall && callCount.current % 7 === 0) lines.push(randomLine("teasing"));
    const near = myGrids.some((g) => isNearWin(g, called, winRows));
    if (near && nearWinSaidFor.current !== last) {
      nearWinSaidFor.current = last;
      lines.push(randomLine("nearWin"));
    }
    speakLines(lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last, on, status]);

  // Ket thuc co nguoi thang -> chuc mung
  const winnersKey = winnerNames.join("|");
  useEffect(() => {
    if (status === "finished" && winnerNames.length > 0 && on) {
      speakLines([randomLine("kinh"), `Chúc mừng ${winnerNames.join(", ")}!`, randomLine("closing")]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, winnersKey, on]);

  function toggle() {
    const v = !on;
    setOn(v);
    setVoicePrefOn(v);
    if (!v) stopSpeaking();
    else speakLines(["Đã bật giọng hô lô tô!"]);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button" aria-pressed={on} onClick={toggle}
        className="inline-flex min-h-12 items-center rounded-xl border border-wine px-4 py-2 text-base font-semibold text-wine hover:bg-champagne-soft"
      >
        {on ? "🔊 Giọng hô: BẬT (bấm để tắt)" : "🔇 Giọng hô: tắt (bấm để bật)"}
      </button>
      {on && (
        <label className="flex items-center gap-2 text-base font-semibold">
          Tốc độ
          <select
            value={String(rate)}
            onChange={(e) => { const v = Number(e.target.value); setRate(v); setVoiceRate(v); }}
            className="min-h-12 rounded-xl border border-ink-soft/40 bg-white px-3 text-base"
          >
            <option value="0.8">Chậm rãi</option>
            <option value="0.95">Vừa</option>
            <option value="1.1">Nhanh</option>
          </select>
        </label>
      )}
    </div>
  );
}
