import { describe, expect, it } from "vitest";
import { sha256Bytes, utf8Bytes } from "./sha256";
import {
  commitHash, createWordStream, lotoCallOrder, lotteryWinners, randBelow, seededShuffle, verifyLoto, verifyLottery,
  type LotteryTicket,
} from "./fair";

const SEED_A = "0123456789abcdef".repeat(4);
const SEED_B = "fedcba9876543210".repeat(4);
const ZERO = "00".repeat(32);

// "Vector vang": CAC GIA TRI NAY GIONG HET trong supabase/tests/rls_games.sql (ban SQL phai cho cung ket qua).
describe("vector vang (TS == SQL)", () => {
  it("commit", () => {
    expect(commitHash(ZERO)).toBe("60e05bd1b195af2f94112fa7197a5c88289058840ce7c6df9693756bc6250f55");
    expect(commitHash("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("seededShuffle", () => {
    expect(seededShuffle(ZERO, 10)).toEqual([10, 6, 4, 7, 1, 8, 2, 5, 9, 3]);
    expect(seededShuffle("ab".repeat(32), 1)).toEqual([1]);
    expect(seededShuffle(SEED_A, 90)).toEqual([
      84, 18, 34, 27, 62, 85, 66, 80, 29, 68, 15, 24, 76, 71, 75, 56, 67, 30, 16, 31, 55, 39, 21, 35, 28, 45, 19, 9, 57, 72,
      88, 82, 1, 46, 38, 8, 59, 70, 89, 43, 77, 2, 54, 17, 20, 48, 49, 52, 11, 6, 3, 51, 25, 83, 33, 60, 42, 90, 87, 86, 64,
      78, 40, 53, 61, 79, 58, 50, 4, 47, 7, 81, 36, 44, 12, 69, 32, 23, 26, 37, 65, 73, 14, 41, 63, 13, 5, 10, 22, 74,
    ]);
  });
  it("lotteryWinners", () => {
    const owners = ["u1", "u1", "u2", "u3", "u3", "u3", "u4", "u5"];
    const tickets: LotteryTicket[] = owners.map((owner, i) => ({ no: i + 1, owner }));
    expect(lotteryWinners(SEED_A, tickets, 3)).toEqual([2, 4, 7]);
    // thu tu dau vao tuy y khong doi ket qua
    expect(lotteryWinners(SEED_B, [...tickets].reverse(), 6)).toEqual([1, 6, 8, 7, 3]);
  });
});

describe("seededShuffle", () => {
  it("la hoan vi cua 1..n va xac dinh theo seed", () => {
    for (const n of [0, 1, 2, 3, 10, 90, 257]) {
      const a = seededShuffle(SEED_A, n);
      expect([...a].sort((x, y) => x - y)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      expect(seededShuffle(SEED_A, n)).toEqual(a);
    }
    expect(seededShuffle(SEED_A, 90)).not.toEqual(seededShuffle(SEED_B, 90));
  });

  it("phan bo xap xi deu: vi tri dau tien cua hoan vi 1..6 qua nhieu seed", () => {
    const counts = new Array(7).fill(0);
    const N = 6000;
    for (let i = 0; i < N; i++) {
      const seed = commitHash(`seed-${i}`);
      counts[seededShuffle(seed, 6)[0]]++;
    }
    for (let v = 1; v <= 6; v++) expect(Math.abs(counts[v] - N / 6)).toBeLessThan(150); // sigma ~ 29
  });

  it("randBelow loai bo mau lech: tu >= gioi han bi bo qua", () => {
    // k = 3: limit = floor(2^32/3)*3 = 4294967295; tu 4294967295 phai bi bo
    const words = [0xffffffff, 7];
    let i = 0;
    expect(randBelow(() => words[i++], 3)).toBe(7 % 3);
    expect(() => randBelow(() => 0, 0)).toThrow();
    expect(() => seededShuffle(SEED_A, -1)).toThrow();
  });

  it("dong tu khop cong thuc sha256(seed:block)", () => {
    const next = createWordStream(ZERO);
    const d0 = sha256Bytes(utf8Bytes(`${ZERO}:0`));
    const d1 = sha256Bytes(utf8Bytes(`${ZERO}:1`));
    const be = (d: Uint8Array, o: number) => ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0;
    for (let i = 0; i < 8; i++) expect(next()).toBe(be(d0, i * 4));
    expect(next()).toBe(be(d1, 0));
  });
});

describe("lotteryWinners", () => {
  const tickets: LotteryTicket[] = Array.from({ length: 12 }, (_, i) => ({ no: i + 1, owner: `u${(i % 4) + 1}` }));

  it("moi nguoi chi trung toi da mot giai, khong qua so giai", () => {
    for (let s = 0; s < 50; s++) {
      const w = lotteryWinners(commitHash(`x${s}`), tickets, 3);
      expect(w).toHaveLength(3);
      const owners = w.map((no) => tickets.find((t) => t.no === no)!.owner);
      expect(new Set(owners).size).toBe(3);
      expect(new Set(w).size).toBe(3);
    }
  });

  it("it nguoi hon so giai: chi tra ve so nguoi co ve", () => {
    expect(lotteryWinners(SEED_A, tickets, 10)).toHaveLength(4);
    expect(lotteryWinners(SEED_A, [], 3)).toEqual([]);
  });

  it("moi ve co co hoi nhu nhau cho giai nhat", () => {
    const counts = new Map<number, number>();
    const N = 6000;
    for (let s = 0; s < N; s++) {
      const [first] = lotteryWinners(commitHash(`f${s}`), tickets, 1);
      counts.set(first, (counts.get(first) ?? 0) + 1);
    }
    for (const t of tickets) expect(Math.abs((counts.get(t.no) ?? 0) - N / 12)).toBeLessThan(110); // sigma ~ 21
  });
});

describe("kiem chung commit-reveal", () => {
  const tickets: LotteryTicket[] = [1, 2, 3, 4, 5, 6].map((no) => ({ no, owner: `u${((no + 1) % 3) + 1}` }));
  const seed = SEED_A;
  const commit = commitHash(seed);
  const winners = lotteryWinners(seed, tickets, 2);

  it("xo so: hop le khi khop", () => {
    expect(verifyLottery({ commit, seed, tickets, prizeCount: 2, winnersByRank: winners })).toEqual({ ok: true, problems: [] });
  });
  it("xo so: phat hien seed bi doi, ket qua bi sua, ve bi them", () => {
    expect(verifyLottery({ commit, seed: SEED_B, tickets, prizeCount: 2, winnersByRank: winners }).ok).toBe(false);
    expect(verifyLottery({ commit, seed, tickets, prizeCount: 2, winnersByRank: [...winners].reverse() }).ok).toBe(false);
    expect(verifyLottery({ commit, seed, tickets, prizeCount: 2, winnersByRank: [winners[0], winners[0]] }).ok).toBe(false);
    expect(verifyLottery({ commit, seed, tickets, prizeCount: 2, winnersByRank: [winners[0]] }).ok).toBe(false);
    expect(verifyLottery({ commit, seed: "zz", tickets, prizeCount: 2, winnersByRank: winners }).ok).toBe(false);
  });
  it("lo to: so da ho phai la dau hoan vi cua seed", () => {
    const order = lotoCallOrder(seed);
    expect(order).toHaveLength(90);
    expect(verifyLoto({ commit, seed, called: order.slice(0, 17) }).ok).toBe(true);
    expect(verifyLoto({ commit, seed, called: [] }).ok).toBe(true);
    const bad = order.slice(0, 17);
    [bad[0], bad[1]] = [bad[1], bad[0]];
    expect(verifyLoto({ commit, seed, called: bad }).ok).toBe(false);
    expect(verifyLoto({ commit: commitHash("khac"), seed, called: order.slice(0, 5) }).ok).toBe(false);
  });
});
