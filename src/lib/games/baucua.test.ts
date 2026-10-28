import { describe, expect, it } from "vitest";
import { exactRtp, matches, payout, rollDice, rollDie, SYMBOLS } from "./baucua";

function lcgBytes(seed: number) {
  // mulberry32 -> byte
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) & 0xff;
  };
}

describe("luat tra thuong co dien", () => {
  it("dat n vao o ra k lan -> n + k*n; khong ra -> 0", () => {
    expect(payout(10, 1, [1, 2, 3])).toBe(20);
    expect(payout(10, 1, [1, 1, 3])).toBe(30);
    expect(payout(10, 1, [1, 1, 1])).toBe(40);
    expect(payout(10, 1, [2, 3, 4])).toBe(0);
    expect(payout(7, 6, [6, 6, 2])).toBe(21);
    expect(matches(2, [2, 2, 5])).toBe(2);
  });
  it("co 6 o dung ten", () => {
    expect(SYMBOLS.map((s) => s.label)).toEqual(["Bầu", "Cua", "Tôm", "Cá", "Gà", "Nai"]);
  });
  it("RTP chinh xac = 199/216 ~ 92,13% (liet ke 216 ket qua) cho moi o", () => {
    const r = exactRtp();
    expect(r.numerator).toBe(199);
    expect(r.denominator).toBe(216);
    expect(r.value).toBeCloseTo(0.9213, 4);
    for (let sym = 1; sym <= 6; sym++) {
      let tot = 0;
      for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) tot += payout(1, sym, [a, b, c]);
      expect(tot).toBe(199);
    }
  });
});

describe("mo phong thong ke", () => {
  it("1.000.000 van: RTP ~ 92,1% (dung sai 1%, ~9 sigma)", () => {
    const next = lcgBytes(2024);
    const N = 1_000_000;
    let ret = 0;
    for (let i = 0; i < N; i++) ret += payout(1, 3, rollDice(next));
    const rtp = ret / N;
    expect(Math.abs(rtp - 199 / 216)).toBeLessThan(0.01);
    expect(rtp).toBeGreaterThan(0.9);
    expect(rtp).toBeLessThan(0.94);
  });

  it("xuc xac deu 1..6 (chi-binh phuong, 600000 lan lac)", () => {
    const next = lcgBytes(77);
    const N = 600_000;
    const c = new Array(7).fill(0);
    for (let i = 0; i < N; i++) c[rollDie(next)]++;
    let chi = 0;
    for (let v = 1; v <= 6; v++) chi += (c[v] - N / 6) ** 2 / (N / 6);
    // 5 bac tu do: gia tri toi han 99,99% ~ 25,7
    expect(chi).toBeLessThan(25.7);
  });

  it("loai bo mau lech: byte >= 252 khong tao ra xuc xac", () => {
    const seq = [255, 253, 252, 251];
    let i = 0;
    expect(rollDie(() => seq[i++])).toBe((251 % 6) + 1);
    expect(i).toBe(4);
  });

  it("khong co chien luoc 'gap doi' gia tang ky vong: gap doi sau moi lan thua van co RTP ~ 92%", () => {
    // Martingale tren 200000 chuoi toi da 5 van: tong tra / tong dat van ~ 92%
    const next = lcgBytes(31337);
    let staked = 0;
    let returned = 0;
    for (let s = 0; s < 200_000; s++) {
      let bet = 1;
      for (let step = 0; step < 5; step++) {
        staked += bet;
        const back = payout(bet, 1, rollDice(next));
        returned += back;
        if (back > 0) break;
        bet *= 2;
      }
    }
    expect(Math.abs(returned / staked - 199 / 216)).toBeLessThan(0.02);
  });
});
