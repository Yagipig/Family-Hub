import type { ReactNode } from "react";
import type { Effect, Motif, Palette } from "@/lib/card-templates";

/**
 * Hình minh họa thiệp: toàn bộ là SVG/CSS tự vẽ, không dùng hình hay nhân vật có bản quyền.
 * Mọi hình dùng bảng màu của mẫu (đỏ rượu / champagne / be) và không phụ thuộc id để dùng được nhiều lần trên một trang.
 */

function Blossom({ x, y, r, petal, center }: { x: number; y: number; r: number; petal: string; center: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={0} cy={-r * 0.62} rx={r * 0.52} ry={r * 0.64} fill={petal} transform={`rotate(${a})`} />
      ))}
      <circle r={r * 0.3} fill={center} />
    </g>
  );
}

function Star({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const pts = Array.from({ length: 8 }, (_, i) => {
    const ang = (Math.PI / 4) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.32;
    return `${(x + Math.cos(ang) * rad).toFixed(1)},${(y + Math.sin(ang) * rad).toFixed(1)}`;
  });
  return <polygon points={pts.join(" ")} fill={fill} />;
}

function Lantern({ x, y, s, body, trim }: { x: number; y: number; s: number; body: string; trim: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <line x1="0" y1="-30" x2="0" y2="-20" stroke={trim} strokeWidth="2" />
      <rect x="-9" y="-22" width="18" height="6" rx="2" fill={trim} />
      <ellipse cx="0" cy="4" rx="24" ry="22" fill={body} />
      <ellipse cx="0" cy="4" rx="12" ry="22" fill="none" stroke={trim} strokeWidth="1.6" opacity="0.8" />
      <ellipse cx="0" cy="4" rx="24" ry="22" fill="none" stroke={trim} strokeWidth="1.6" opacity="0.8" />
      <line x1="0" y1="-18" x2="0" y2="26" stroke={trim} strokeWidth="1.4" opacity="0.8" />
      <rect x="-9" y="24" width="18" height="6" rx="2" fill={trim} />
      {[-6, 0, 6].map((dx) => <line key={dx} x1={dx} y1="30" x2={dx} y2="48" stroke={trim} strokeWidth="1.8" />)}
    </g>
  );
}

export function CardMotif({ motif, palette, className }: { motif: Motif; palette: Palette; className?: string }): ReactNode {
  const { accent, text, particle, bg } = palette;
  let inner: ReactNode;
  switch (motif) {
    case "mai":
      inner = (
        <>
          <path d="M8 152 C48 132 70 104 110 92 S164 56 192 30" fill="none" stroke="#5a3a22" strokeWidth="5" strokeLinecap="round" />
          <path d="M110 92 C122 120 140 132 168 128" fill="none" stroke="#5a3a22" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M62 120 C56 104 60 94 70 88" fill="none" stroke="#5a3a22" strokeWidth="3" strokeLinecap="round" />
          <Blossom x={60} y={120} r={19} petal={accent} center="#b3261e" />
          <Blossom x={110} y={90} r={23} petal={accent} center="#b3261e" />
          <Blossom x={158} y={54} r={19} petal={accent} center="#b3261e" />
          <Blossom x={188} y={30} r={12} petal={accent} center="#b3261e" />
          <Blossom x={150} y={128} r={15} petal={accent} center="#b3261e" />
          <Blossom x={70} y={86} r={11} petal={accent} center="#b3261e" />
          {[[34, 134], [92, 118], [132, 70], [176, 78]].map(([cx, cy]) => <circle key={`${cx}`} cx={cx} cy={cy} r="4.5" fill={accent} />)}
        </>
      );
      break;
    case "redenvelope":
      inner = (
        <>
          <rect x="52" y="14" width="96" height="132" rx="8" fill="#c1121f" stroke={accent} strokeWidth="3" />
          <path d="M52 22 Q100 78 148 22 L148 22 L148 14 L52 14 Z" fill="#a4161a" stroke={accent} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="100" cy="82" r="24" fill={accent} />
          <circle cx="100" cy="82" r="17" fill="none" stroke="#a4161a" strokeWidth="2.5" />
          {[0, 90, 180, 270].map((a) => <rect key={a} x="-3.5" y="-15" width="7" height="7" fill="#a4161a" transform={`translate(100 82) rotate(${a + 45})`} />)}
          <rect x="68" y="122" width="64" height="4" rx="2" fill={accent} />
          <rect x="80" y="130" width="40" height="3" rx="1.5" fill={accent} opacity="0.7" />
        </>
      );
      break;
    case "lantern":
      inner = (
        <>
          <path d="M10 18 Q100 4 190 18" fill="none" stroke={accent} strokeWidth="2.5" />
          <Lantern x={56} y={50} s={1.15} body="#c1121f" trim={accent} />
          <Lantern x={146} y={58} s={1.0} body="#a4161a" trim={accent} />
          <Lantern x={100} y={96} s={0.7} body="#d62828" trim={accent} />
        </>
      );
      break;
    case "balloons":
      inner = (
        <>
          {[
            { x: 58, y: 62, c: "#7b1e2b", r: 32 },
            { x: 104, y: 50, c: "#c9a96b", r: 36 },
            { x: 148, y: 66, c: "#a4313f", r: 30 },
          ].map((b) => (
            <g key={b.x}>
              <path d={`M${b.x} ${b.y + b.r} Q${b.x - 8} ${b.y + b.r + 30} ${b.x + 4} 154`} fill="none" stroke={text} strokeWidth="1.6" opacity="0.7" />
              <polygon points={`${b.x - 5},${b.y + b.r + 7} ${b.x + 5},${b.y + b.r + 7} ${b.x},${b.y + b.r - 1}`} fill={b.c} />
              <ellipse cx={b.x} cy={b.y} rx={b.r * 0.82} ry={b.r} fill={b.c} />
              <ellipse cx={b.x - b.r * 0.32} cy={b.y - b.r * 0.38} rx={b.r * 0.14} ry={b.r * 0.24} fill="#fff" opacity="0.35" transform={`rotate(25 ${b.x - b.r * 0.32} ${b.y - b.r * 0.38})`} />
            </g>
          ))}
          <Star x={22} y={30} r={9} fill={particle} />
          <Star x={184} y={28} r={8} fill={particle} />
          <Star x={176} y={118} r={6} fill={particle} />
        </>
      );
      break;
    case "cake":
      inner = (
        <>
          <ellipse cx="100" cy="146" rx="70" ry="9" fill={text} opacity="0.18" />
          <rect x="40" y="104" width="120" height="38" rx="8" fill="#a4313f" />
          <rect x="56" y="70" width="88" height="38" rx="8" fill="#7b1e2b" />
          <path d="M40 112 q10 12 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 v-8 h-120 z" fill="#fffdf8" />
          <path d="M56 78 q11 12 22 0 t22 0 t22 0 t22 0 v-8 h-88 z" fill="#fffdf8" />
          {[78, 100, 122].map((x) => (
            <g key={x}>
              <rect x={x - 3} y="48" width="6" height="24" rx="2" fill={accent} />
              <path d={`M${x} 28 q8 8 0 18 q-8 -10 0 -18z`} fill="#f2c14e" />
              <path d={`M${x} 34 q4 5 0 11 q-4 -6 0 -11z`} fill="#e76f51" />
            </g>
          ))}
        </>
      );
      break;
    case "candle":
      inner = (
        <>
          <circle cx="100" cy="52" r="46" fill={accent} opacity="0.09" />
          <circle cx="100" cy="52" r="30" fill={accent} opacity="0.14" />
          <path d="M100 18 q14 18 0 38 q-14 -20 0 -38z" fill="#f4d58d" />
          <path d="M100 30 q7 10 0 22 q-7 -12 0 -22z" fill="#e8883a" />
          <rect x="91" y="58" width="18" height="62" rx="3" fill="#fbf0d9" />
          <rect x="91" y="58" width="18" height="6" rx="3" fill="#e9dcc0" />
          <ellipse cx="100" cy="122" rx="34" ry="8" fill={accent} />
          <rect x="66" y="122" width="68" height="10" fill={accent} opacity="0.85" />
          <path d="M58 150 Q100 128 142 150" fill="none" stroke={accent} strokeWidth="2.5" />
          {[[34, 126], [166, 126]].map(([x, y]) => <path key={x} d={`M${x} ${y} q6 -14 12 0 q-6 6 -12 0z`} fill={accent} opacity="0.7" />)}
        </>
      );
      break;
    case "rose":
      inner = (
        <>
          <path d="M100 100 C98 130 102 146 98 158" fill="none" stroke="#3f6b3a" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="76" cy="128" rx="22" ry="9" fill="#4d7c46" transform="rotate(-28 76 128)" />
          <ellipse cx="126" cy="136" rx="22" ry="9" fill="#4d7c46" transform="rotate(26 126 136)" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <ellipse key={a} cx="100" cy="42" rx="19" ry="31" fill={accent} opacity="0.92" stroke={bg} strokeWidth="1" transform={`rotate(${a} 100 62)`} />
          ))}
          <circle cx="100" cy="62" r="22" fill="#a4313f" />
          <path d="M100 62 m-12 0 a12 12 0 1 1 12 12 a8 8 0 0 1 -8 -8 a5 5 0 0 1 5 -5" fill="none" stroke={bg} strokeWidth="2.4" strokeLinecap="round" />
        </>
      );
      break;
    case "rings":
      inner = (
        <>
          <circle cx="82" cy="86" r="38" fill="none" stroke={accent} strokeWidth="9" />
          <circle cx="118" cy="86" r="38" fill="none" stroke="#7b1e2b" strokeWidth="9" opacity="0.92" />
          <path d="M100 52 a38 38 0 0 1 0 68" fill="none" stroke={accent} strokeWidth="9" />
          <polygon points="82,40 90,30 74,30" fill="#fffdf8" stroke={accent} strokeWidth="2" />
          <Star x={30} y={36} r={9} fill={particle} />
          <Star x={172} y={34} r={7} fill={particle} />
          <Star x={176} y={130} r={9} fill={particle} />
          <Star x={26} y={128} r={6} fill={particle} />
        </>
      );
      break;
    case "lotus":
      inner = (
        <>
          <ellipse cx="100" cy="142" rx="74" ry="11" fill="#6f8f5c" opacity="0.75" />
          <ellipse cx="54" cy="136" rx="30" ry="8" fill="#5b7d4b" />
          <ellipse cx="148" cy="138" rx="30" ry="8" fill="#5b7d4b" />
          <g transform="translate(100 134)">
            {[-70, -35, 0, 35, 70].map((a) => (
              <path key={`b${a}`} d="M0 0 Q18 -34 0 -76 Q-18 -34 0 0z" fill={particle} opacity="0.7" transform={`rotate(${a})`} />
            ))}
            {[-48, -16, 16, 48].map((a) => (
              <path key={`f${a}`} d="M0 0 Q16 -30 0 -64 Q-16 -30 0 0z" fill="#fbe7e4" stroke={accent} strokeWidth="1.4" transform={`rotate(${a})`} />
            ))}
            <path d="M0 0 Q14 -30 0 -62 Q-14 -30 0 0z" fill="#fff5f3" stroke={accent} strokeWidth="1.6" />
            <circle cx="0" cy="-14" r="5" fill="#f2c14e" />
          </g>
        </>
      );
      break;
    case "starlantern":
      inner = (
        <>
          <circle cx="156" cy="40" r="26" fill="#fbf0d9" opacity="0.92" />
          <circle cx="166" cy="34" r="22" fill={bg} />
          <line x1="86" y1="6" x2="86" y2="26" stroke={accent} strokeWidth="2.5" />
          <polygon
            points={Array.from({ length: 10 }, (_, i) => {
              const ang = (Math.PI / 5) * i - Math.PI / 2;
              const rad = i % 2 === 0 ? 46 : 21;
              return `${(86 + Math.cos(ang) * rad).toFixed(1)},${(78 + Math.sin(ang) * rad).toFixed(1)}`;
            }).join(" ")}
            fill="#c1121f" stroke={accent} strokeWidth="3" strokeLinejoin="round"
          />
          <circle cx="86" cy="78" r="12" fill={accent} />
          <circle cx="86" cy="78" r="5.5" fill="#c1121f" />
          {[-12, -4, 4, 12].map((dx) => <line key={dx} x1={86 + dx} y1="124" x2={86 + dx} y2={146 + Math.abs(dx) / 2} stroke={accent} strokeWidth="2" />)}
          <Star x={140} y={112} r={9} fill={particle} />
          <Star x={176} y={96} r={6} fill={particle} />
          <Star x={30} y={36} r={6} fill={particle} />
        </>
      );
      break;
    case "burst":
    default:
      inner = (
        <>
          {Array.from({ length: 16 }, (_, i) => {
            const ang = (Math.PI / 8) * i;
            const r1 = 34;
            const r2 = i % 2 === 0 ? 68 : 54;
            return (
              <line key={i} x1={100 + Math.cos(ang) * r1} y1={82 + Math.sin(ang) * r1} x2={100 + Math.cos(ang) * r2} y2={82 + Math.sin(ang) * r2}
                stroke={accent} strokeWidth={i % 2 === 0 ? 5 : 3} strokeLinecap="round" />
            );
          })}
          <circle cx="100" cy="82" r="26" fill={accent} />
          <circle cx="100" cy="82" r="18" fill="none" stroke={bg} strokeWidth="3" />
          <Star x={24} y={28} r={9} fill={particle} />
          <Star x={178} y={30} r={7} fill={particle} />
          <Star x={174} y={136} r={9} fill={particle} />
          <Star x={28} y={138} r={7} fill={particle} />
        </>
      );
  }
  return (
    <svg viewBox="0 0 200 160" role="img" aria-hidden="true" className={className} xmlns="http://www.w3.org/2000/svg">
      {inner}
    </svg>
  );
}

const PARTICLE_COUNT: Record<Effect, number> = { envelope: 0, petals: 22, confetti: 30, lantern: 9 };

/** Lớp hạt hiệu ứng (cánh hoa/pháo giấy/đèn lồng). Vị trí cố định theo chỉ số, không dùng ngẫu nhiên để tránh lệch khi hiển thị. */
export function CardParticles({ effect, palette }: { effect: Effect; palette: Palette }) {
  const n = PARTICLE_COUNT[effect];
  if (!n) return null;
  const colors = [palette.particle, palette.accent, palette.text];
  return (
    <div className="fhc-particles" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const left = (i * 37 + 11) % 96;
        const delay = ((i * 53) % 25) / 10;
        const dur = effect === "lantern" ? 5.5 + (i % 4) * 0.8 : 3.2 + (i % 5) * 0.6;
        const dx = ((i * 29) % 90) - 45;
        const color = colors[i % colors.length];
        const style = { left: `${left}%`, animationDelay: `${delay}s`, animationDuration: `${dur}s`, ["--dx" as string]: `${dx}px`, ["--rot" as string]: `${360 + (i % 4) * 90}deg`, color } as React.CSSProperties;
        if (effect === "petals") {
          return (
            <svg key={i} className="fhc-particle fhc-fall" style={style} width="22" height="22" viewBox="0 0 22 22">
              <path d="M11 1 C18 6 18 16 11 21 C4 16 4 6 11 1z" fill="currentColor" opacity="0.85" />
            </svg>
          );
        }
        if (effect === "confetti") {
          return <span key={i} className="fhc-particle fhc-fall" style={{ ...style, background: color, width: i % 3 === 0 ? 10 : 7, height: i % 3 === 0 ? 7 : 12, borderRadius: i % 4 === 0 ? 999 : 2 }} />;
        }
        return (
          <svg key={i} className="fhc-particle fhc-rise" style={style} width="26" height="34" viewBox="0 0 26 34">
            <ellipse cx="13" cy="18" rx="10" ry="12" fill="currentColor" opacity="0.8" />
            <ellipse cx="13" cy="18" rx="16" ry="18" fill="currentColor" opacity="0.18" />
            <rect x="9" y="4" width="8" height="3" rx="1.5" fill="currentColor" />
          </svg>
        );
      })}
    </div>
  );
}
