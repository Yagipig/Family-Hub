import type { CSSProperties } from "react";
import { DEFAULT_TITLES, type CardTemplate } from "@/lib/card-templates";
import { CardMotif, CardParticles } from "@/components/CardArt";

/**
 * Giao diện thiệp (thuần CSS/SVG). Lớp CSS có tiền tố fhc-; hiệu ứng chuyển động tôn trọng prefers-reduced-motion
 * (tắt hoàn toàn hoạt ảnh và chuyển tiếp, ẩn các hạt).
 */
export const CARD_CSS = `
.fhc-card{position:relative;overflow:hidden;border-radius:20px;padding:30px 24px 26px;min-height:440px;display:flex;flex-direction:column;align-items:center;text-align:center;color:var(--fhc-text);background:linear-gradient(160deg,var(--fhc-bg),var(--fhc-bg2));box-shadow:0 10px 30px rgba(60,20,25,.25)}
.fhc-card::before{content:"";position:absolute;inset:10px;border:2px solid var(--fhc-accent);border-radius:14px;opacity:.85;pointer-events:none}
.fhc-card::after{content:"";position:absolute;inset:16px;border:1px solid var(--fhc-accent);border-radius:10px;opacity:.45;pointer-events:none}
.fhc-art{width:min(260px,72%);margin:6px auto 2px}
.fhc-art svg{display:block;width:100%;height:auto}
.fhc-title{font-family:Georgia,"Times New Roman",serif;font-size:1.65rem;line-height:1.25;font-weight:700;margin:6px 0 12px;padding-bottom:10px;border-bottom:2px solid var(--fhc-accent);max-width:100%;overflow-wrap:anywhere}
.fhc-msg{font-size:1.2rem;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;max-width:34ch;width:100%}
.fhc-from{margin-top:auto;padding-top:20px;font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:1.15rem}
.fhc-stage{position:relative;max-width:420px;margin:0 auto}
.fhc-particles{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:3;border-radius:20px}
.fhc-particle{position:absolute;top:0;display:block;opacity:0;animation-fill-mode:both;animation-iteration-count:1;animation-timing-function:ease-in}
.fhc-fall{animation-name:fhc-fall}
.fhc-rise{top:auto;bottom:0;animation-name:fhc-rise;animation-timing-function:ease-out}
.fhc-pop{animation:fhc-pop .7s ease-out both}
.fhc-sealed{position:relative;border-radius:20px;padding:26px 18px;text-align:center;color:var(--fhc-text);background:linear-gradient(160deg,var(--fhc-bg),var(--fhc-bg2));box-shadow:0 10px 30px rgba(60,20,25,.25);overflow:hidden}
.fhc-sealed::before{content:"";position:absolute;inset:10px;border:2px solid var(--fhc-accent);border-radius:14px;opacity:.85;pointer-events:none}
.fhc-env{width:100%;height:auto;overflow:visible}
.fhc-env .fhc-letter{transition:transform .9s ease-out .55s}
.fhc-env .fhc-flap-closed{transform-origin:150px 60px;transition:transform .6s ease-in,opacity .4s ease-in .15s}
.fhc-env .fhc-flap-open{opacity:0;transition:opacity .4s ease-out .3s}
.fhc-env.is-open .fhc-letter{transform:translateY(-78px)}
.fhc-env.is-open .fhc-flap-closed{transform:scaleY(.04);opacity:0}
.fhc-env.is-open .fhc-flap-open{opacity:1}
.fhc-wobble{animation:fhc-wobble 2.4s ease-in-out infinite}
@keyframes fhc-fall{0%{transform:translate3d(0,-14%,0) rotate(0);opacity:0}12%{opacity:1}100%{transform:translate3d(var(--dx,0px),480px,0) rotate(var(--rot,360deg));opacity:0}}
@keyframes fhc-rise{0%{transform:translate3d(0,0,0);opacity:0}15%{opacity:1}100%{transform:translate3d(var(--dx,0px),-480px,0);opacity:0}}
@keyframes fhc-pop{from{transform:scale(.93) translateY(12px);opacity:0}to{transform:none;opacity:1}}
@keyframes fhc-wobble{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.2deg)}}
@media (prefers-reduced-motion:reduce){
  .fhc-particles{display:none}
  .fhc-particle,.fhc-pop,.fhc-wobble{animation:none!important}
  .fhc-env .fhc-letter,.fhc-env .fhc-flap-closed,.fhc-env .fhc-flap-open{transition:none!important}
}
`;

export function CardStyles() {
  // React 19 loại bỏ trùng lặp theo "href" khi có "precedence"
  return <style href="fhc-card-css" precedence="default">{CARD_CSS}</style>;
}

export function templateVars(t: CardTemplate): CSSProperties {
  return {
    ["--fhc-bg" as string]: t.palette.bg,
    ["--fhc-bg2" as string]: t.palette.bg2,
    ["--fhc-text" as string]: t.palette.text,
    ["--fhc-accent" as string]: t.palette.accent,
    ["--fhc-particle" as string]: t.palette.particle,
  } as CSSProperties;
}

export function CardView({
  template, title, message, senderName, withParticles = false, animateIn = false,
}: { template: CardTemplate; title: string | null; message: string; senderName: string; withParticles?: boolean; animateIn?: boolean }) {
  return (
    <div className="fhc-stage" style={templateVars(template)}>
      <CardStyles />
      <article className={`fhc-card${animateIn ? " fhc-pop" : ""}`} aria-label={`Thiệp: ${template.name}`}>
        <div className="fhc-art"><CardMotif motif={template.motif} palette={template.palette} /></div>
        <h3 className="fhc-title">{title?.trim() || DEFAULT_TITLES[template.occasion]}</h3>
        <p className="fhc-msg">{message || "Lời chúc của bạn sẽ hiện ở đây."}</p>
        <p className="fhc-from">— {senderName}</p>
      </article>
      {withParticles && <CardParticles effect={template.effect} palette={template.palette} />}
    </div>
  );
}

/** Hình thu nhỏ của mẫu (danh sách, chọn mẫu). */
export function CardThumb({ template, className = "" }: { template: CardTemplate; className?: string }) {
  return (
    <div
      className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl ${className}`}
      style={{ background: `linear-gradient(160deg, ${template.palette.bg}, ${template.palette.bg2})`, boxShadow: `inset 0 0 0 2px ${template.palette.accent}` }}
    >
      <div className="w-[78%]"><CardMotif motif={template.motif} palette={template.palette} className="block h-auto w-full" /></div>
    </div>
  );
}
