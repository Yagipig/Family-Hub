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
  try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch { /* bo qua */ }
  emitSpeak(false);
}
