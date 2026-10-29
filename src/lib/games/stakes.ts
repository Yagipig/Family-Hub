/** Menh gia la dung cho ca XIN CAP (admin duyet) va DAT CUOC khi vao phong lo to. */
export const STAKE_DENOMINATIONS = [1000, 2000, 5000, 10000, 20000, 50000] as const;
export const MIN_STAKE: number = STAKE_DENOMINATIONS[0];
/** Bot cuoc ao muc nho nhat (khong qua vi). */
export const BOT_STAKE = 1000;

export function isStakeDenom(n: number): boolean {
  return (STAKE_DENOMINATIONS as readonly number[]).includes(n);
}

/** 1000 -> "1.000" (dau cham ngan hang theo tieng Viet). */
export function fmtLa(n: number): string {
  return n.toLocaleString("vi-VN");
}
