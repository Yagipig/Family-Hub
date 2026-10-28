import { describe, expect, it } from "vitest";
import { colRange, completedRows, generateLotoCard, isKinh, isValidLotoCard, lotoRows } from "./loto";

// PRNG xac dinh (mulberry32) de test lap lai duoc
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const below = (r: () => number) => (k: number) => Math.floor(r() * k);

describe("to lo to sinh o server", () => {
  const r = rng(12345);
  const cards = Array.from({ length: 3000 }, () => generateLotoCard(below(r)));

  it("moi to hop le: 27 o, moi hang 5 so, so trong dai cot, tang dan, khong trung", () => {
    for (const c of cards) {
      expect(c).toHaveLength(27);
      expect(isValidLotoCard(c)).toBe(true);
      for (const row of lotoRows(c)) expect(row).toHaveLength(5);
      const nums = c.filter((v) => v !== 0);
      expect(nums).toHaveLength(15);
      expect(new Set(nums).size).toBe(15);
    }
  });

  it("moi cot co 1-3 so, dung dai cot", () => {
    for (const c of cards) {
      for (let col = 0; col < 9; col++) {
        const vals = [0, 1, 2].map((row) => c[row * 9 + col]).filter((v) => v !== 0);
        expect(vals.length).toBeGreaterThanOrEqual(1);
        expect(vals.length).toBeLessThanOrEqual(3);
        const [lo, hi] = colRange(col);
        for (const v of vals) {
          expect(v).toBeGreaterThanOrEqual(lo);
          expect(v).toBeLessThanOrEqual(hi);
        }
      }
    }
  });

  it("so xuat hien deu: moi so 1..90 xuat hien trong tap to (phan bo khong lech dang ke)", () => {
    const count = new Array(91).fill(0);
    for (const c of cards) for (const v of c) if (v) count[v]++;
    // cot dau chi co 9 so nen xac suat moi so cao hon cot khac; kiem tra trong tung cot, ty le max/min nho
    for (let col = 0; col < 9; col++) {
      const [lo, hi] = colRange(col);
      const xs = Array.from({ length: hi - lo + 1 }, (_, i) => count[lo + i]);
      expect(Math.max(...xs) / Math.min(...xs)).toBeLessThan(1.25);
    }
  });
});

describe("kiem tra to hop le: phat hien to sai", () => {
  const good = generateLotoCard(below(rng(7)));
  const firstNonZero = (c: number[], from: number, to: number, nonzero: boolean) => {
    for (let i = from; i < to; i++) if ((c[i] !== 0) === nonzero) return i;
    return -1;
  };

  it("to goc hop le", () => expect(isValidLotoCard(good)).toBe(true));
  it("sai do dai / kieu", () => {
    expect(isValidLotoCard(good.slice(0, 26))).toBe(false);
    expect(isValidLotoCard([...good, 0])).toBe(false);
    expect(isValidLotoCard(new Array(27).fill(0))).toBe(false);
    expect(isValidLotoCard(good.map((v) => v + 0.5))).toBe(false);
  });
  it("hang 4 so hoac 6 so", () => {
    const c4 = [...good];
    c4[firstNonZero(c4, 0, 9, true)] = 0;
    expect(isValidLotoCard(c4)).toBe(false);
    const c6 = [...good];
    const z = firstNonZero(c6, 0, 9, false);
    c6[z] = z === 0 ? 5 : z === 8 ? 85 : z * 10 + 5;
    expect(isValidLotoCard(c6)).toBe(false);
  });
  it("so ngoai dai cot", () => {
    const c = [...good];
    const i = firstNonZero(c, 0, 9, true);
    c[i] = i === 8 ? 5 : 90;
    expect(isValidLotoCard(c)).toBe(false);
  });
  it("trung so / sai thu tu trong cot", () => {
    for (let col = 0; col < 9; col++) {
      const idx = [0, 1, 2].map((r) => r * 9 + col).filter((i) => good[i] !== 0);
      if (idx.length < 2) continue;
      const swapped = [...good];
      [swapped[idx[0]], swapped[idx[1]]] = [swapped[idx[1]], swapped[idx[0]]];
      expect(isValidLotoCard(swapped)).toBe(false);
      const dup = [...good];
      dup[idx[1]] = dup[idx[0]];
      expect(isValidLotoCard(dup)).toBe(false);
      return;
    }
    throw new Error("khong co cot nao co 2 so");
  });
});

describe("kinh", () => {
  const card = generateLotoCard(below(rng(99)));
  const rows = lotoRows(card);

  it("khong kinh khi chua du mot hang", () => {
    expect(isKinh(card, [])).toBe(false);
    expect(isKinh(card, rows[0].slice(0, 4))).toBe(false);
    // du 4/5 moi hang nhung khong hang nao du
    expect(isKinh(card, rows.flatMap((r) => r.slice(0, 4)))).toBe(false);
  });
  it("kinh khi du dung mot hang (so thua khong anh huong)", () => {
    expect(isKinh(card, rows[1])).toBe(true);
    expect(completedRows(card, new Set([...rows[2], 1, 2, 3]))).toEqual([2]);
    expect(isKinh(card, new Set(card.filter(Boolean)))).toBe(true);
    expect(completedRows(card, new Set(card.filter(Boolean)))).toEqual([0, 1, 2]);
  });
  it("so khong thuoc to khong tao ra kinh", () => {
    const outside = Array.from({ length: 90 }, (_, i) => i + 1).filter((n) => !card.includes(n));
    expect(isKinh(card, outside)).toBe(false);
  });
});
