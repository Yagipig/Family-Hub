import { describe, expect, it } from "vitest";
import { callLineFor, randomLine, NUMBER_LINES, GENERIC_LINES } from "./call-lines";
import { generateLotoCard, isNearWin, isValidLotoCard, relayoutLotoCard } from "./loto";

// RNG co seed de test on dinh (mulberry32)
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randBelowFrom = (rand: () => number) => (k: number) => Math.floor(rand() * k);

describe("Cau ho lo to", () => {
  it("chatter = 0 thi luon la 'So n' gon gang", () => {
    for (const n of [1, 7, 39, 90]) {
      expect(callLineFor(n, { chatter: 0, rand: seeded(n) })).toBe(`Số ${n}`);
    }
  });
  it("chatter = 100 thi cau nao cung xac dinh duoc con so (cau ve cua chinh so do, hoac cau chung co so)", () => {
    for (let n = 1; n <= 90; n++) {
      const line = callLineFor(n, { chatter: 100, rand: seeded(n * 7) });
      // Cau ve ket bang tieng ho cua chinh so n; cau chung thi chua thang chu so n
      expect(line === NUMBER_LINES[n] || line.includes(String(n))).toBe(true);
      expect(line.length).toBeGreaterThan(4);
    }
  });
  it("cau chung nao cung co {n} de thay so", () => {
    expect(GENERIC_LINES.every((g) => g.includes("{n}"))).toBe(true);
  });
  it("du ca 90 so deu co cau ve rieng (yeu cau nguoi dung 30/10/2026)", () => {
    expect(Object.keys(NUMBER_LINES)).toHaveLength(90);
    for (let n = 1; n <= 90; n++) {
      const line = NUMBER_LINES[n];
      expect(line, `thieu cau ve cho so ${n}`).toBeTruthy();
      expect(line.length).toBeGreaterThan(15);
    }
  });
  it("cau hat dai 15-20 giay va TU CUOI CUNG chinh la tieng ho so (dieu ganh hat)", () => {
    // Tieng ho chot o cuoi moi cau hat — khong co doan "la con so N" phia sau.
    const ENDINGS: Record<number, string> = {
      1: "con một!", 2: "anh Hai!", 3: "chị Ba!", 4: "anh Tư!", 5: "chị Năm!",
      6: "anh Sáu!", 7: "chị Bảy!", 8: "anh Tám!", 9: "anh Chín!", 10: "tròn mười!",
      11: "con khỉ đột!", 12: "mười hai!", 13: "mười ba!", 14: "mười bốn!", 15: "mười lăm!",
      16: "mười sáu!", 17: "mười bảy!", 18: "mười tám!", 19: "mười chín!", 20: "hai mươi!",
      21: "hai mốt!", 22: "hai hai!", 23: "hai ba!", 24: "hai bốn!", 25: "hai lăm!",
      26: "hai sáu!", 27: "hai bảy!", 28: "hai tám!", 29: "hai chín!", 30: "ba mươi!",
      31: "ba mốt!", 32: "ba hai!", 33: "ba ba!", 34: "ba bốn!", 35: "ba lăm!",
      36: "ba sáu!", 37: "ba bảy!", 38: "ba tám!", 39: "ba chín!", 40: "bốn mươi!",
      41: "bốn mốt!", 42: "bốn hai!", 43: "bốn ba!", 44: "bốn bốn!", 45: "bốn lăm!",
      46: "bốn sáu!", 47: "bốn bảy!", 48: "bốn tám!", 49: "bốn chín!", 50: "năm mươi!",
      51: "năm mốt!", 52: "năm hai!", 53: "năm ba!", 54: "năm bốn!", 55: "năm lăm!",
      56: "năm sáu!", 57: "năm bảy!", 58: "năm tám!", 59: "năm chín!", 60: "sáu mươi!",
      61: "sáu mốt!", 62: "sáu hai!", 63: "sáu ba!", 64: "sáu bốn!", 65: "sáu lăm!",
      66: "sáu sáu!", 67: "sáu bảy!", 68: "sáu tám!", 69: "sáu chín!", 70: "bảy mươi!",
      71: "bảy mốt!", 72: "bảy hai!", 73: "bảy ba!", 74: "bảy bốn!", 75: "bảy lăm!",
      76: "bảy sáu!", 77: "bảy bảy!", 78: "bảy tám!", 79: "bảy chín!", 80: "tám mươi!",
      81: "tám mốt!", 82: "tám hai!", 83: "tám ba!", 84: "tám bốn!", 85: "tám lăm!",
      86: "tám sáu!", 87: "tám bảy!", 88: "tám tám!", 89: "tám chín!", 90: "chín mươi!",
    };
    for (let n = 1; n <= 90; n++) {
      const line = NUMBER_LINES[n];
      expect(line, `cau so ${n} chua dung dieu`).toContain(", ");
      expect(line.length, `cau so ${n} qua ngan`).toBeGreaterThanOrEqual(130);
      expect(line.endsWith(ENDINGS[n]), `cau so ${n} phai ket bang tieng ho "${ENDINGS[n]}"`).toBe(true);
      expect(line).not.toContain("là con số");
    }
  });
  it("cau them cua admin duoc tron vao va thay {n}", () => {
    const line = callLineFor(5, { chatter: 100, extraLines: ["Cau rieng cua nha minh: so {n}!"], rand: () => 0.999 });
    // rand cao: bo qua cau rieng cua so (neu co), chon cau o cuoi pool -> co the la cau admin hoac cau chung cuoi
    expect(line).toContain("5");
    expect(line).not.toContain("{n}");
  });
  it("randomLine tra ve cau khac rong cho moi nhom", () => {
    for (const g of ["opening", "closing", "teasing", "nearWin", "kinh"] as const) {
      expect(randomLine(g, seeded(3)).length).toBeGreaterThan(5);
    }
  });
});

describe("Sap kinh (isNearWin)", () => {
  // Bang co dinh (dung dai cot): hang 1 = 1,12,23,34,45; hang 2 = 2,13,24,35,56; hang 3 = 3,14,25,47,67
  const grid = [
    1, 12, 23, 34, 45, 0, 0, 0, 0,
    2, 13, 24, 35, 0, 56, 0, 0, 0,
    3, 14, 25, 0, 47, 0, 67, 0, 0,
  ];
  it("thang 1 hang: hang khac thieu 1 so la sap kinh", () => {
    expect(isValidLotoCard(grid)).toBe(true);
    // Du hang 1 (1,12,23,34,45) va hang 2 thieu so 56
    expect(isNearWin(grid, [1, 12, 23, 34, 45, 2, 13, 24, 35], 1)).toBe(true);
    // Chua du hang nao va khong hang nao thieu 1 -> khong
    expect(isNearWin(grid, [1, 12, 23], 1)).toBe(false);
  });
  it("thang 2 hang: phai du 1 hang truoc + 1 hang thieu 1 so", () => {
    expect(isNearWin(grid, [2, 13, 24, 35], 2)).toBe(false); // chua du hang nao
    expect(isNearWin(grid, [1, 12, 23, 34, 45, 2, 13, 24, 35], 2)).toBe(true);
  });
});

describe("Xep lai bo cuc giu nguyen so (relayout)", () => {
  it("giu dung 15 so, to moi hop le, chay duoc nhieu to", () => {
    for (let s = 1; s <= 40; s++) {
      const card = generateLotoCard(randBelowFrom(seeded(s * 100)));
      const before = card.filter((v) => v !== 0).sort((a, b) => a - b);
      const out = relayoutLotoCard(card, randBelowFrom(seeded(s * 100 + 1)));
      expect(out).not.toBeNull();
      expect(isValidLotoCard(out!)).toBe(true);
      expect(out!.filter((v) => v !== 0).sort((a, b) => a - b)).toEqual(before);
    }
  });
  it("to khong hop le thi tra null", () => {
    expect(relayoutLotoCard(new Array(27).fill(0), () => 0)).toBeNull();
    expect(relayoutLotoCard([1, 2, 3], () => 0)).toBeNull();
  });
});
