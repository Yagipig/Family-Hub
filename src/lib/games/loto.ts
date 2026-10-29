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

/** Bang co "sap kinh" khong: da du winRows-1 hang va con mot hang chi thieu dung 1 so. */
export function isNearWin(card: readonly number[], called: readonly number[], winRows: number): boolean {
  const set = new Set(called);
  if (completedRows(card, set).length < winRows - 1) return false;
  return lotoRows(card).some((row) => row.filter((v) => !set.has(v)).length === 1);
}

/**
 * Xep lai bo cuc GIU NGUYEN dung 15 con so cua to: moi so thuoc ve mot cot co dinh theo dai so,
 * chi thay doi so nam o hang nao (trong cot: so nho o tren). Tim cach xep bang quay lui ngau nhien
 * sao cho moi hang van co dung 5 so. Tra ve to moi hop le, hoac null neu khong tim duoc (rat hiem).
 */
export function relayoutLotoCard(card: readonly number[], randBelow: (k: number) => number): LotoCard | null {
  if (!isValidLotoCard(card)) return null;
  // Gom so theo cot (da tang dan trong cot do to hop le).
  const byCol: number[][] = Array.from({ length: LOTO_COLS }, () => []);
  for (let c = 0; c < LOTO_COLS; c++) {
    for (let r = 0; r < LOTO_ROWS; r++) {
      const v = card[r * LOTO_COLS + c];
      if (v !== 0) byCol[c].push(v);
    }
  }
  const shuffled = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = randBelow(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  // Thu nhieu lan: moi lan xao thu tu cot + thu tu hang ung vien roi tham lam co quay lui nhe.
  for (let attempt = 0; attempt < 300; attempt++) {
    const rowFree = new Array<number>(LOTO_ROWS).fill(LOTO_PER_ROW);
    const place: number[][] = Array.from({ length: LOTO_COLS }, () => []);
    let ok = true;
    for (const c of shuffled(Array.from({ length: LOTO_COLS }, (_, i) => i))) {
      const k = byCol[c].length;
      const combos: number[][] = [];
      for (let mask = 0; mask < (1 << LOTO_ROWS); mask++) {
        const rows = [0, 1, 2].filter((r) => mask & (1 << r));
        if (rows.length === k) combos.push(rows);
      }
      const candidates = shuffled(combos).filter((rows) => rows.every((r) => rowFree[r] > 0));
      if (candidates.length === 0) { ok = false; break; }
      const rows = candidates[0];
      for (const r of rows) rowFree[r]--;
      place[c] = rows;
    }
    if (!ok || rowFree.some((f) => f !== 0)) continue;
    const out = new Array<number>(LOTO_COLS * LOTO_ROWS).fill(0);
    for (let c = 0; c < LOTO_COLS; c++) {
      const rows = [...place[c]].sort((a, b) => a - b);
      byCol[c].forEach((v, i) => { out[rows[i] * LOTO_COLS + c] = v; });
    }
    if (isValidLotoCard(out)) return out;
  }
  return null;
}
