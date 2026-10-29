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
  it("chatter = 100 thi cau nao cung chua con so", () => {
    for (let n = 1; n <= 90; n++) {
      const line = callLineFor(n, { chatter: 100, rand: seeded(n * 7) });
      expect(line).toContain(String(n));
      expect(line.length).toBeGreaterThan(4);
    }
  });
  it("so co cau rieng thi cau rieng cung chua dung so", () => {
    for (const [k, line] of Object.entries(NUMBER_LINES)) {
      expect(line).toContain(k);
    }
    expect(GENERIC_LINES.every((g) => g.includes("{n}"))).toBe(true);
  });
  it("du ca 90 so deu co cau ve rieng (yeu cau nguoi dung 30/10/2026)", () => {
    expect(Object.keys(NUMBER_LINES)).toHaveLength(90);
    for (let n = 1; n <= 90; n++) {
      const line = NUMBER_LINES[n];
      expect(line, `thieu cau ve cho so ${n}`).toBeTruthy();
      expect(line).toContain(String(n));
      expect(line.length).toBeGreaterThan(15);
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
