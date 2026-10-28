/**
 * Số tiền GHI NHẬN của lì xì. Family Hub không chuyển/nhận tiền; đây chỉ là con số người dùng ghi lại.
 * Lưu theo đơn vị nhỏ nhất của loại tiền (amount_minor): VND, JPY, KRW không có phần lẻ; USD/EUR… có 2 chữ số lẻ.
 */

export const SUPPORTED_CURRENCIES = ["VND", "JPY", "USD", "EUR", "KRW", "AUD", "CAD", "GBP", "SGD", "THB", "CNY", "TWD"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];
export const MAX_AMOUNT_MINOR = 100_000_000_000_000;

const ZERO_DECIMAL = new Set(["VND", "JPY", "KRW"]);

export function isSupportedCurrency(c: string): c is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(c);
}

export function minorDigits(currency: string): number {
  return ZERO_DECIMAL.has(currency) ? 0 : 2;
}

/**
 * Đọc số tiền người dùng gõ ("500.000", "500,000", "1.250,50", "1,250.50", "20") thành đơn vị nhỏ nhất.
 * Trả về null nếu không hiểu được hoặc ≤ 0 hoặc quá lớn.
 */
export function parseAmountToMinor(text: string, currency: string): number | null {
  const digits = minorDigits(currency);
  const s = text.trim().replace(/[\s'’]/g, "");
  if (!s || !/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const lastSep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  let intPart = s;
  let fracPart = "";
  if (lastSep >= 0) {
    const after = s.slice(lastSep + 1);
    const before = s.slice(0, lastSep);
    const sepChar = s[lastSep];
    const sameSepBefore = before.includes(sepChar);
    // Là phần thập phân khi: loại tiền có phần lẻ, phía sau có 1..digits chữ số, và dấu đó không lặp lại ở phần trước
    const looksDecimal = digits > 0 && after.length >= 1 && after.length <= digits && !sameSepBefore;
    if (looksDecimal) {
      intPart = before;
      fracPart = after;
    }
  }
  intPart = intPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(intPart || "0")) return null;
  if (fracPart && !/^\d+$/.test(fracPart)) return null;
  const frac = (fracPart + "0".repeat(digits)).slice(0, digits);
  const minorStr = (intPart || "0") + frac;
  if (minorStr.length > 15) return null;
  const n = Number(minorStr);
  if (!Number.isSafeInteger(n) || n <= 0 || n > MAX_AMOUNT_MINOR) return null;
  return n;
}

export function formatMinor(amountMinor: number, currency: string): string {
  const digits = minorDigits(currency);
  const value = amountMinor / 10 ** digits;
  try {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  } catch {
    return `${value.toLocaleString("vi-VN")} ${currency}`;
  }
}

export function formatGiftAmount(amountMinor: number | null | undefined, currency: string | null | undefined): string {
  if (amountMinor == null || !currency) return "Không ghi số tiền";
  return formatMinor(amountMinor, currency);
}
