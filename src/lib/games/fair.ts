// Quay so minh bach (commit-reveal). Thuat toan CONG KHAI, dung chung cho xo so va lo to.
// Ban SQL tuong duong: public.fair_commit / fair_shuffle / lottery_compute_winners (migration games).
// Neu sua o day PHAI sua o SQL va cap nhat "vector vang" trong ca hai bo test.
import { sha256Bytes, sha256Hex, utf8Bytes } from "./sha256";

/** Cam ket cong bo truoc khi quay: sha256 cua chuoi hex cua seed (UTF-8). */
export function commitHash(seedHex: string): string {
  return sha256Hex(seedHex);
}

/**
 * Dong "tu" 32 bit xac dinh tu seed: tu thu i lay tu khoi sha256(seed + ":" + floor(i/8)),
 * 4 byte lien tiep (big-endian) o vi tri (i mod 8) * 4.
 */
export function createWordStream(seedHex: string): () => number {
  let idx = 0;
  let block = -1;
  let digest: Uint8Array = new Uint8Array(32);
  return () => {
    const b = Math.floor(idx / 8);
    if (b !== block) {
      digest = sha256Bytes(utf8Bytes(`${seedHex}:${b}`));
      block = b;
    }
    const o = (idx % 8) * 4;
    idx += 1;
    return ((digest[o] << 24) | (digest[o + 1] << 16) | (digest[o + 2] << 8) | digest[o + 3]) >>> 0;
  };
}

/** So nguyen deu trong [0, k) tu dong tu, loai bo mau lech (rejection sampling). */
export function randBelow(nextWord: () => number, k: number): number {
  if (!Number.isInteger(k) || k < 1 || k > 0x7fffffff) throw new RangeError("k khong hop le");
  const limit = Math.floor(0x100000000 / k) * k;
  for (;;) {
    const w = nextWord();
    if (w < limit) return w % k;
  }
}

/** Hoan vi cua 1..n bang Fisher-Yates (i tu n xuong 2) voi dong tu cua seed. */
export function seededShuffle(seedHex: string, n: number): number[] {
  if (!Number.isInteger(n) || n < 0 || n > 100000) throw new RangeError("n khong hop le");
  const a = Array.from({ length: n }, (_, i) => i + 1);
  const next = createWordStream(seedHex);
  for (let i = n; i >= 2; i--) {
    const j = randBelow(next, i);
    const t = a[i - 1];
    a[i - 1] = a[j];
    a[j] = t;
  }
  return a;
}

export type LotteryTicket = { no: number; owner: string };

/**
 * Chon so ve trung giai theo thu hang: xao tron cac ve (da sap tang theo so ve) bang seed,
 * duyet theo thu tu xao, moi nguoi chi trung toi da mot giai (bo qua ve cua nguoi da trung).
 * Tra ve mang so ve theo hang 1, 2, ... (co the ngan hon prizeCount neu khong du nguoi).
 */
export function lotteryWinners(seedHex: string, tickets: LotteryTicket[], prizeCount: number): number[] {
  const sorted = [...tickets].sort((x, y) => x.no - y.no);
  const order = seededShuffle(seedHex, sorted.length);
  const won = new Set<string>();
  const out: number[] = [];
  for (const idx of order) {
    if (out.length >= prizeCount) break;
    const t = sorted[idx - 1];
    if (won.has(t.owner)) continue;
    won.add(t.owner);
    out.push(t.no);
  }
  return out;
}

/** Thu tu ho so cua lo to: hoan vi cua 1..90 tu seed. */
export function lotoCallOrder(seedHex: string): number[] {
  return seededShuffle(seedHex, 90);
}

export type VerifyResult = { ok: boolean; problems: string[] };

/** Kiem chung xo so: cam ket khop seed, ket qua cong bo khop thuat toan cong khai. */
export function verifyLottery(input: {
  commit: string;
  seed: string;
  tickets: LotteryTicket[];
  prizeCount: number;
  winnersByRank: number[]; // so ve cua hang 1, 2, ...
}): VerifyResult {
  const problems: string[] = [];
  if (!/^[0-9a-f]{64}$/.test(input.seed)) problems.push("Seed không đúng định dạng.");
  else {
    if (commitHash(input.seed) !== input.commit.toLowerCase()) problems.push("Seed không khớp với mã cam kết đã công bố trước khi quay.");
    const expect = lotteryWinners(input.seed, input.tickets, input.prizeCount);
    if (expect.length !== input.winnersByRank.length || expect.some((v, i) => v !== input.winnersByRank[i]))
      problems.push("Kết quả công bố khác kết quả tính lại từ seed.");
  }
  return { ok: problems.length === 0, problems };
}

/** Kiem chung lo to: cam ket khop seed, cac so da ho la dau cua hoan vi tinh tu seed. */
export function verifyLoto(input: { commit: string; seed: string; called: number[] }): VerifyResult {
  const problems: string[] = [];
  if (!/^[0-9a-f]{64}$/.test(input.seed)) problems.push("Seed không đúng định dạng.");
  else {
    if (commitHash(input.seed) !== input.commit.toLowerCase()) problems.push("Seed không khớp với mã cam kết đã công bố trước khi bắt đầu.");
    const order = lotoCallOrder(input.seed);
    if (input.called.length > 90 || input.called.some((v, i) => v !== order[i]))
      problems.push("Các số đã hô khác thứ tự tính lại từ seed.");
  }
  return { ok: problems.length === 0, problems };
}
