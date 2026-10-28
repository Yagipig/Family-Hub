// Bau cua tom ca (diem ao). Luat co dien: dat n vao o, ra k lan (0..3) => nhan lai n + k*n neu k >= 1, k = 0 thi mat n.
// Ban SQL: public._bc_payout / _bc_roll_dice (migration games_baucua).

export const SYMBOLS = [
  { id: 1, key: "bau", label: "Bầu", emoji: "🎃" },
  { id: 2, key: "cua", label: "Cua", emoji: "🦀" },
  { id: 3, key: "tom", label: "Tôm", emoji: "🦐" },
  { id: 4, key: "ca", label: "Cá", emoji: "🐟" },
  { id: 5, key: "ga", label: "Gà", emoji: "🐓" },
  { id: 6, key: "nai", label: "Nai", emoji: "🦌" },
] as const;

export type SymbolId = 1 | 2 | 3 | 4 | 5 | 6;
export type Dice = [number, number, number];

export function symbolLabel(id: number): string {
  return SYMBOLS.find((s) => s.id === id)?.label ?? "?";
}

/** So lan o `symbol` xuat hien tren 3 xuc xac. */
export function matches(symbol: number, dice: readonly number[]): number {
  return dice.filter((d) => d === symbol).length;
}

/** Tien tra ve (da gom tien goc): amount * (1 + k) neu k >= 1, nguoc lai 0. */
export function payout(amount: number, symbol: number, dice: readonly number[]): number {
  const k = matches(symbol, dice);
  return k === 0 ? 0 : amount * (1 + k);
}

/** Lac mot xuc xac deu 1..6 tu nguon byte ngau nhien (loai bo mau lech: byte >= 252 bi bo). */
export function rollDie(nextByte: () => number): number {
  for (;;) {
    const b = nextByte() & 0xff;
    if (b < 252) return (b % 6) + 1;
  }
}

export function rollDice(nextByte: () => number): Dice {
  return [rollDie(nextByte), rollDie(nextByte), rollDie(nextByte)];
}

/** Ti le hoan tra ky vong chinh xac cho 1 diem dat vao 1 o, liet ke du 216 ket qua: 199/216 ~ 92,13%. */
export function exactRtp(): { numerator: number; denominator: number; value: number } {
  let total = 0;
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++)
      for (let c = 1; c <= 6; c++) total += payout(1, 1, [a, b, c]);
  return { numerator: total, denominator: 216, value: total / 216 };
}
