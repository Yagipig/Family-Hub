// Lo to kieu Viet Nam: to 9 cot x 3 hang, moi hang 5 so (4 o trong), so theo dai cot, tang dan trong cot.
// Luat nay phai khop SQL: public.loto_card_is_valid (migration games_loto).

export const LOTO_COLS = 9;
export const LOTO_ROWS = 3;
export const LOTO_PER_ROW = 5;
/** To luu dang phang theo hang: chi so = hang * 9 + cot; 0 = o trong. */
export type LotoCard = number[];

/** Dai so cua cot c: cot 0 = 1-9, cot 1..7 = 10c..10c+9, cot 8 = 80-90. */
export function colRange(c: number): [number, number] {
  if (c === 0) return [1, 9];
  if (c === 8) return [80, 90];
  return [c * 10, c * 10 + 9];
}

export function isValidLotoCard(card: readonly number[]): boolean {
  if (!Array.isArray(card) || card.length !== LOTO_COLS * LOTO_ROWS) return false;
  if (!card.every((v) => Number.isInteger(v))) return false;
  for (let r = 0; r < LOTO_ROWS; r++) {
    let cnt = 0;
    for (let c = 0; c < LOTO_COLS; c++) {
      const v = card[r * LOTO_COLS + c];
      if (v === 0) continue;
      const [lo, hi] = colRange(c);
      if (v < lo || v > hi) return false;
      cnt++;
    }
    if (cnt !== LOTO_PER_ROW) return false;
  }
  // moi cot 0-3 so (tu nhien do chi co 3 hang), tang nghiem ngat tu tren xuong => khong trung so
  for (let c = 0; c < LOTO_COLS; c++) {
    let prev = 0;
    for (let r = 0; r < LOTO_ROWS; r++) {
      const v = card[r * LOTO_COLS + c];
      if (v === 0) continue;
      if (v <= prev) return false;
      prev = v;
    }
  }
  return true;
}

/** Sinh to hop le. randBelow(k) phai tra ve so nguyen deu trong [0,k). Moi cot co it nhat 1 so. */
export function generateLotoCard(randBelow: (k: number) => number): LotoCard {
  for (;;) {
    const has: boolean[][] = [];
    const colCount = new Array<number>(LOTO_COLS).fill(0);
    for (let r = 0; r < LOTO_ROWS; r++) {
      const cols = Array.from({ length: LOTO_COLS }, (_, i) => i);
      for (let k = 0; k < LOTO_PER_ROW; k++) {
        const j = k + randBelow(LOTO_COLS - k);
        [cols[k], cols[j]] = [cols[j], cols[k]];
      }
      const row = new Array<boolean>(LOTO_COLS).fill(false);
      for (let k = 0; k < LOTO_PER_ROW; k++) {
        row[cols[k]] = true;
        colCount[cols[k]]++;
      }
      has.push(row);
    }
    if (colCount.some((n) => n === 0)) continue;
    const card = new Array<number>(LOTO_COLS * LOTO_ROWS).fill(0);
    for (let c = 0; c < LOTO_COLS; c++) {
      const [lo, hi] = colRange(c);
      const pool = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
      const picked: number[] = [];
      for (let k = 0; k < colCount[c]; k++) {
        const j = k + randBelow(pool.length - k);
        [pool[k], pool[j]] = [pool[j], pool[k]];
        picked.push(pool[k]);
      }
      picked.sort((x, y) => x - y);
      let p = 0;
      for (let r = 0; r < LOTO_ROWS; r++) if (has[r][c]) card[r * LOTO_COLS + c] = picked[p++];
    }
    return card;
  }
}

/** Cac hang cua to: moi hang la mang 5 so. */
export function lotoRows(card: readonly number[]): number[][] {
  return Array.from({ length: LOTO_ROWS }, (_, r) =>
    card.slice(r * LOTO_COLS, (r + 1) * LOTO_COLS).filter((v) => v !== 0),
  );
}

/** Hang nao da du (moi so cua hang nam trong tap so da ho)? Tra ve chi so hang (0..2). */
export function completedRows(card: readonly number[], called: ReadonlySet<number> | readonly number[]): number[] {
  const set = called instanceof Set ? called : new Set(called as readonly number[]);
  return lotoRows(card).flatMap((row, r) => (row.every((v) => set.has(v)) ? [r] : []));
}

/** "Kinh" hop le khi co it nhat mot hang du. May chu quyet dinh bang so da ho, khong dung dau danh dau cua client. */
export function isKinh(card: readonly number[], called: ReadonlySet<number> | readonly number[]): boolean {
  return completedRows(card, called).length > 0;
}
