// Giong ho lo to o phia trinh duyet (Web Speech API, tieng Viet).
// Phat su kien de nhac nen tu giam am luong khi dang ho (ducking): "fh-loto-speak" voi detail.on = true/false.

const ON_KEY = "fh-loto-voice";
const RATE_KEY = "fh-loto-rate";

export function voicePrefOn(): boolean {
  try { return window.localStorage.getItem(ON_KEY) === "1"; } catch { return false; }
}
export function setVoicePrefOn(on: boolean) {
  try { window.localStorage.setItem(ON_KEY, on ? "1" : "0"); } catch { /* bo qua */ }
}
export function voiceRate(): number {
  try {
    const v = Number(window.localStorage.getItem(RATE_KEY));
    return v >= 0.7 && v <= 1.3 ? v : 0.95;
  } catch { return 0.95; }
}
export function setVoiceRate(rate: number) {
  try { window.localStorage.setItem(RATE_KEY, String(rate)); } catch { /* bo qua */ }
}

function emitSpeak(on: boolean) {
  try { window.dispatchEvent(new CustomEvent("fh-loto-speak", { detail: { on } })); } catch { /* bo qua */ }
}

/** Doc mot day cau lien tiep (khong cat ngang nhau). Chi doc khi nguoi dung da bat giong. */
export function speakLines(lines: string[]) {
  if (!voicePrefOn()) return;
  try {
    stopClip();
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const texts = lines.filter((s) => s.trim().length > 0);
    if (texts.length === 0) return;
    emitSpeak(true);
    texts.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "vi-VN";
      u.rate = voiceRate();
      if (i === texts.length - 1) {
        u.onend = () => emitSpeak(false);
        u.onerror = () => emitSpeak(false);
      }
      synth.speak(u);
    });
    // Phong khi trinh duyet khong ban su kien end: tha ducking sau toi da 12s
    window.setTimeout(() => emitSpeak(false), 12000);
  } catch { emitSpeak(false); }
}

export function stopSpeaking() {
  stopClip();
  try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch { /* bo qua */ }
  emitSpeak(false);
}

// ---------------------------------------------------------------------------
// Goi giong THU THAT (voice pack): nha minh tu thu am tung con so theo kich ban,
// file dat o public/voice/loto/: so n -> "n.mp3" (1..90), cau dac biet -> "opening.mp3" / "kinh.mp3".
// manifest.json liet ke clip da co: { "numbers": [1, 2, ...], "specials": ["opening", "kinh"] }.
// So nao chua co clip thi tu dong lui ve giong robot (speakLines) — thu den dau hay den do.

export type VoicePack = { numbers: ReadonlySet<number>; specials: ReadonlySet<string> };
const EMPTY_PACK: VoicePack = { numbers: new Set(), specials: new Set() };
let packPromise: Promise<VoicePack> | null = null;
let packCache: VoicePack | null = null;

/** Kiem tra mot ten clip ("7" = so 7; "opening"/"kinh" = cau dac biet) co trong goi khong. */
export function packHasClip(pack: VoicePack, name: string): boolean {
  const num = Number(name);
  if (Number.isInteger(num) && String(num) === name) return pack.numbers.has(num);
  return pack.specials.has(name);
}

export function loadVoicePack(): Promise<VoicePack> {
  if (packCache) return Promise.resolve(packCache);
  if (!packPromise) {
    packPromise = (async () => {
      try {
        const res = await fetch("/voice/loto/manifest.json", { cache: "force-cache" });
        if (!res.ok) { packCache = EMPTY_PACK; return packCache; }
        const j = (await res.json()) as { numbers?: unknown; specials?: unknown };
        packCache = {
          numbers: new Set(Array.isArray(j.numbers) ? j.numbers.filter((x): x is number => typeof x === "number" && x >= 1 && x <= 90) : []),
          specials: new Set(Array.isArray(j.specials) ? j.specials.filter((x): x is string => typeof x === "string") : []),
        };
        return packCache;
      } catch { packCache = EMPTY_PACK; return packCache; }
    })();
  }
  return packPromise;
}

let currentAudio: HTMLAudioElement | null = null;

function stopClip() {
  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.currentTime = 0; } catch { /* bo qua */ }
    currentAudio = null;
  }
}

/**
 * Phat clip thu that theo ten. Tra ve true neu co clip va phat duoc;
 * onDone chi chay khi clip phat xong tu nhien (dung de noi tiep cau TTS sau clip).
 * Khong co clip / bi trinh duyet chan -> false, nguoi goi tu lui ve giong robot.
 */
export async function playClip(name: string, onDone?: () => void): Promise<boolean> {
  if (!voicePrefOn()) return false;
  const pack = await loadVoicePack();
  if (!packHasClip(pack, name)) return false;
  try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch { /* bo qua */ }
  stopClip();
  const a = new Audio(`/voice/loto/${name}.mp3`);
  currentAudio = a;
  emitSpeak(true);
  let settled = false;
  const finish = (ok: boolean) => {
    if (settled) return;
    settled = true;
    if (currentAudio === a) currentAudio = null;
    emitSpeak(false);
    if (ok) onDone?.();
  };
  a.onended = () => finish(true);
  a.onerror = () => finish(false);
  // Phong khi clip hong khong bao loi: toi da 15s thi tha ducking va coi nhu xong
  window.setTimeout(() => { if (currentAudio === a) finish(true); }, 15000);
  try {
    await a.play();
    return true;
  } catch {
    finish(false);
    return false;
  }
}
