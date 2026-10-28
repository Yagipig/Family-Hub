import { z } from "zod";

/**
 * Kiểm tra đầu vào cho thông tin nhận tiền (Module C). Thuần hàm, không phụ thuộc máy chủ để kiểm thử được.
 * Nguyên tắc: Family Hub KHÔNG lưu số thẻ, mật khẩu, PIN, OTP, CVV.
 */

export const PAYOUT_KINDS = ["bank", "ewallet", "other"] as const;
export type PayoutKind = (typeof PAYOUT_KINDS)[number];
export const PAYOUT_KIND_LABELS: Record<PayoutKind, string> = {
  bank: "Tài khoản ngân hàng",
  ewallet: "Ví điện tử",
  other: "Cách nhận khác",
};

/** Thuật toán Luhn (kiểm tra chữ số cuối của số thẻ). */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/**
 * Số này có "dáng" số thẻ của một mạng thẻ phổ biến (Visa, Mastercard, Amex, Discover/UnionPay, JCB, Diners, Napas)?
 * Dùng thêm với Luhn để giảm chặn nhầm số TÀI KHOẢN ngân hàng (có thể dài 13+ chữ số và ngẫu nhiên hợp Luhn).
 */
export function looksLikeCardNetwork(d: string): boolean {
  const n = d.length;
  const p = (k: number) => Number(d.slice(0, k));
  if (d[0] === "4") return n === 13 || n === 16 || n === 19;                                    // Visa
  if (n === 16 && ((p(2) >= 51 && p(2) <= 55) || (p(4) >= 2221 && p(4) <= 2720))) return true;  // Mastercard
  if (n === 15 && (p(2) === 34 || p(2) === 37)) return true;                                    // American Express
  if (n >= 16 && n <= 19 && (p(4) === 6011 || p(2) === 65 || (p(3) >= 644 && p(3) <= 649) || p(2) === 62)) return true; // Discover, UnionPay
  if (n >= 16 && n <= 19 && p(4) >= 3528 && p(4) <= 3589) return true;                          // JCB
  if (n >= 14 && n <= 19 && (p(2) === 36 || p(2) === 38 || p(2) === 39 || (p(3) >= 300 && p(3) <= 305))) return true;   // Diners
  if (n >= 16 && n <= 19 && p(4) === 9704) return true;                                        // Napas (thẻ nội địa Việt Nam)
  return false;
}

/**
 * Tìm một dãy 13–19 chữ số LIÊN TỤC (cho phép ngăn cách bằng đúng một dấu cách hoặc gạch ngang giữa hai chữ số,
 * như khi gõ số thẻ theo nhóm 4) mà hợp lệ theo Luhn VÀ có đầu số/độ dài của một mạng thẻ. Trả về dãy tìm thấy, hoặc null.
 */
export function findCardNumber(text: string): string | null {
  for (const m of text.matchAll(/\d(?:[ -]?\d)*/g)) {
    const digits = m[0].replace(/[^\d]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits) && looksLikeCardNetwork(digits)) return digits;
  }
  return null;
}

const SECRET_WORDS =
  /(mật\s*khẩu|mat\s*khau|password|passcode|passwd|\botp\b|mã\s*(xác\s*thực|otp|pin)|ma\s*(xac\s*thuc|otp|pin)|\bpin\b|\bcvv2?\b|\bcvc\b|số\s*thẻ|so\s*the\b|card\s*number|thẻ\s*tín\s*dụng|the\s*tin\s*dung)/iu;

export const CARD_NUMBER_MESSAGE =
  "Dãy số này trông giống SỐ THẺ ngân hàng (đầu số và độ dài của thẻ Visa/Mastercard/…). Family Hub không lưu số thẻ để giữ an toàn cho bạn. " +
  "Hãy chỉ nhập số TÀI KHOẢN hoặc ID ví để người thân chuyển tiền. Nếu số tài khoản thật của bạn bị nhận nhầm là số thẻ, " +
  "đừng nhập vào đây mà hãy nhắn trực tiếp cho người gửi.";
export const SECRET_WORD_MESSAGE =
  "Phần này có vẻ nhắc tới mật khẩu / mã OTP / PIN / CVV. TUYỆT ĐỐI không nhập mật khẩu, mã OTP, mã PIN hay số thẻ vào Family Hub.";

/** Trả về lý do tiếng Việt nếu văn bản chứa thứ không được lưu; null nếu ổn. */
export function sensitiveReason(text: string): string | null {
  if (findCardNumber(text)) return CARD_NUMBER_MESSAGE;
  if (SECRET_WORDS.test(text)) return SECRET_WORD_MESSAGE;
  return null;
}

const alnumLength = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "").length;
const NUMBER_CHARS = /^[\p{L}\p{N} .\-_@+]+$/u;

export const payoutInputSchema = z
  .object({
    kind: z.enum(PAYOUT_KINDS, { error: "Hãy chọn loại thông tin nhận tiền." }),
    label: z.string().trim().min(1, "Hãy đặt một tên gợi nhớ (ví dụ: Vietcombank của tôi).").max(60, "Tên gợi nhớ tối đa 60 ký tự."),
    holder: z.string().trim().min(1, "Hãy nhập tên chủ tài khoản.").max(120, "Tên chủ tài khoản tối đa 120 ký tự."),
    number: z
      .string()
      .trim()
      .min(4, "Số tài khoản / ID ví quá ngắn.")
      .max(64, "Số tài khoản / ID ví tối đa 64 ký tự.")
      .refine((v) => NUMBER_CHARS.test(v), "Chỉ dùng chữ, số, dấu cách, dấu chấm, gạch ngang, @ và +.")
      .refine((v) => alnumLength(v) >= 6, "Số tài khoản / ID ví cần ít nhất 6 chữ hoặc số."),
    note: z.string().trim().max(200, "Ghi chú tối đa 200 ký tự.").optional().default(""),
  })
  .superRefine((v, ctx) => {
    for (const field of ["label", "holder", "number", "note"] as const) {
      const reason = sensitiveReason(v[field]);
      if (reason) ctx.addIssue({ code: "custom", path: [field], message: reason });
    }
  });
export type PayoutInput = z.infer<typeof payoutInputSchema>;

/** Nội dung được mã hóa (một khối JSON). */
export type PayoutSecret = { v: 1; holder: string; number: string; note: string };

export function toSecret(input: PayoutInput): PayoutSecret {
  return { v: 1, holder: input.holder, number: input.number, note: input.note ?? "" };
}

export function parseSecret(json: string): PayoutSecret {
  const raw = JSON.parse(json) as Partial<PayoutSecret>;
  if (raw?.v !== 1 || typeof raw.holder !== "string" || typeof raw.number !== "string") {
    throw new Error("Định dạng thông tin không đúng.");
  }
  return { v: 1, holder: raw.holder, number: raw.number, note: typeof raw.note === "string" ? raw.note : "" };
}

/** 4 ký tự cuối (chữ/số) để che; chỉ lưu khi số đủ dài (>= 8) để không lộ gần hết số ngắn. */
export function last4Of(number: string): string | null {
  const clean = number.replace(/[^\p{L}\p{N}]/gu, "");
  if (clean.length < 8) return null;
  const tail = clean.slice(-4);
  return /^[A-Za-z0-9]{4}$/.test(tail) ? tail : null;
}

export function maskedNumber(last4: string | null | undefined): string {
  return last4 ? `••••${last4}` : "••••";
}
