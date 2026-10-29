"use client";
import { useEffect, useRef } from "react";

/**
 * Hieu ung mung thang: phao giay + phao hoa tren canvas (~5,5 giay) va tieng fanfare/vo tay
 * tong hop bang WebAudio (khong can tep am thanh). Chi chay 1 lan cho moi fireKey (ke ca khi
 * trang tu lam moi), nho sessionStorage.
 */
export function WinCelebration({ fireKey, big = false }: { fireKey: string; big?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const guardKey = `fh-celebrated:${fireKey}`;
    try {
      if (window.sessionStorage.getItem(guardKey) === "1") return;
      window.sessionStorage.setItem(guardKey, "1");
    } catch { /* bo qua */ }

    fanfare();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = (canvas.width = window.innerWidth);
    const H = (canvas.height = window.innerHeight);
    const COLORS = ["#8a1538", "#d4a017", "#f5e0a3", "#2e7d32", "#1565c0", "#e65100", "#ffffff"];
    type P = { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; color: string; circle: boolean; life: number };
    const parts: P[] = [];
    const spawnConfetti = (n: number) => {
      for (let i = 0; i < n; i++) {
        parts.push({
          x: Math.random() * W, y: -20 - Math.random() * H * 0.3,
          vx: (Math.random() - 0.5) * 1.6, vy: 2 + Math.random() * 3,
          w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
          rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.25,
          color: COLORS[Math.floor(Math.random() * COLORS.length)], circle: false, life: 1,
        });
      }
    };
    const spawnFirework = () => {
      const cx = W * (0.2 + Math.random() * 0.6);
      const cy = H * (0.15 + Math.random() * 0.3);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2;
        const sp = 2.4 + Math.random() * 3.4;
        parts.push({
          x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          w: 5, h: 5, rot: 0, vr: 0, color, circle: true, life: 1,
        });
      }
    };
    spawnConfetti(big ? 160 : 110);
    spawnFirework();
    const fwTimer = window.setInterval(spawnFirework, 900);
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        if (p.circle) { p.vy += 0.03; p.vx *= 0.99; p.vy *= 0.99; p.life -= 0.008; }
        else { p.vy = Math.min(p.vy + 0.02, 3.4); p.x += Math.sin(p.rot) * 0.6; }
        if (p.y > H + 30 || p.life <= 0) { parts.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.circle) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < 5500) raf = requestAnimationFrame(tick);
      else { ctx.clearRect(0, 0, W, H); window.clearInterval(fwTimer); }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.clearInterval(fwTimer); };
  }, [fireKey, big]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[60]" />;
}

/** Fanfare ngan + tieng vo tay (noise) bang WebAudio; im lang neu trinh duyet chua cho phep. */
function fanfare() {
  try {
    const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === "suspended") { void ctx.resume().catch(() => { /* bo qua */ }); }
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + i * 0.13 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.13 + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.13);
      osc.stop(ctx.currentTime + i * 0.13 + 0.55);
    });
    // Vo tay: 3 dot noise ngan
    for (let k = 0; k < 3; k++) {
      const dur = 0.35;
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.12;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass"; filter.frequency.value = 1600;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(ctx.currentTime + 0.55 + k * 0.4);
    }
    window.setTimeout(() => { void ctx.close().catch(() => { /* bo qua */ }); }, 2600);
  } catch { /* bo qua */ }
}
