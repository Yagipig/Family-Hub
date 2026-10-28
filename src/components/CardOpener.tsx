"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import type { CardTemplate } from "@/lib/card-templates";
import { CardView, CardStyles, templateVars } from "@/components/CardView";
import { CardMotif, CardParticles } from "@/components/CardArt";
import { buttonClass, buttonGhostClass } from "@/components/ui";

type Phase = "sealed" | "opening" | "open";

/**
 * Hiệu ứng mở thiệp. Luôn có nút "Bỏ qua hiệu ứng". Người dùng bật "giảm chuyển động" ở hệ điều hành
 * vẫn bấm "Mở thiệp" như bình thường nhưng thiệp hiện ngay, không có hoạt ảnh (CSS tắt hết hoạt ảnh).
 * onOpened (ví dụ đánh dấu "đã mở" ở máy chủ) chỉ gọi một lần, và KHÔNG gọi ở chế độ xem thử.
 */
export function CardOpener({
  template, title, message, senderName, alreadyOpened = false, onOpened, preview = false,
}: {
  template: CardTemplate; title: string | null; message: string; senderName: string;
  alreadyOpened?: boolean; onOpened?: () => Promise<unknown>; preview?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(alreadyOpened ? "open" : "sealed");
  const [, startTransition] = useTransition();
  const [fxPlayed, setFxPlayed] = useState(false);
  const notified = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function notifyOnce() {
    if (notified.current || preview || !onOpened) return;
    notified.current = true;
    startTransition(async () => {
      try { await onOpened(); } catch { /* không chặn việc xem thiệp nếu ghi nhận thất bại */ }
    });
  }
  function open() {
    notifyOnce();
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setPhase("open"); return; }
    setFxPlayed(true);
    setPhase("opening");
    timer.current = setTimeout(() => setPhase("open"), template.effect === "envelope" ? 2100 : 1100);
  }
  function skip() {
    if (timer.current) clearTimeout(timer.current);
    notifyOnce();
    setPhase("open");
  }

  if (phase === "open") {
    return (
      <div className="space-y-4">
        <CardView template={template} title={title} message={message} senderName={senderName}
          withParticles={fxPlayed && template.effect !== "envelope"} animateIn />
        <div className="text-center">
          <button type="button" className={buttonGhostClass} onClick={() => { notified.current = true; setPhase("sealed"); }}>
            Xem lại hiệu ứng mở thiệp
          </button>
        </div>
        <p role="status" className="sr-only">Thiệp đã mở.</p>
      </div>
    );
  }

  const isEnvelope = template.effect === "envelope";
  return (
    <div className="space-y-4">
      <CardStyles />
      <div className="fhc-stage" style={templateVars(template)}>
        {isEnvelope ? (
          <svg viewBox="0 -40 300 260" className={`fhc-env${phase === "opening" ? " is-open" : ""}`} role="img" aria-label="Phong bì thiệp">
            <rect x="20" y="60" width="260" height="150" rx="10" fill={template.palette.bg2} stroke={template.palette.accent} strokeWidth="3" />
            <polygon className="fhc-flap-open" points="20,60 150,-22 280,60" fill={template.palette.bg} stroke={template.palette.accent} strokeWidth="3" strokeLinejoin="round" />
            <g className="fhc-letter">
              <rect x="42" y="74" width="216" height="124" rx="6" fill="#fffdf8" stroke={template.palette.accent} strokeWidth="2" />
              <rect x="64" y="94" width="172" height="8" rx="4" fill={template.palette.accent} opacity="0.6" />
              <rect x="64" y="114" width="140" height="6" rx="3" fill={template.palette.accent} opacity="0.35" />
              <rect x="64" y="130" width="156" height="6" rx="3" fill={template.palette.accent} opacity="0.35" />
            </g>
            <polygon points="20,70 150,150 280,70 280,200 270,210 30,210 20,200" fill={template.palette.bg} stroke={template.palette.accent} strokeWidth="3" strokeLinejoin="round" />
            <polygon className="fhc-flap-closed" points="20,60 150,142 280,60" fill={template.palette.bg} stroke={template.palette.accent} strokeWidth="3" strokeLinejoin="round" />
            <circle cx="150" cy="140" r="14" fill={template.palette.accent} />
            <circle cx="150" cy="140" r="7" fill={template.palette.bg} />
          </svg>
        ) : (
          <div className="fhc-sealed">
            <div className={`mx-auto w-[min(240px,70%)] ${phase === "sealed" ? "fhc-wobble" : ""}`}>
              <CardMotif motif={template.motif} palette={template.palette} className="block h-auto w-full" />
            </div>
            <p className="mt-3 text-xl font-bold" style={{ color: template.palette.text }}>
              {phase === "opening" ? "Đang mở thiệp…" : "Một tấm thiệp dành cho bạn"}
            </p>
          </div>
        )}
        {phase === "opening" && !isEnvelope && <CardParticles effect={template.effect} palette={template.palette} />}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" className={buttonClass} onClick={open} disabled={phase === "opening"}>
          {preview ? "Xem thử hiệu ứng mở" : "Mở thiệp"}
        </button>
        <button type="button" className={buttonGhostClass} onClick={skip}>Bỏ qua hiệu ứng</button>
      </div>
      {!preview && (
        <p className="text-center text-sm text-ink-soft">Người gửi sẽ biết bạn đã mở thiệp.</p>
      )}
    </div>
  );
}
