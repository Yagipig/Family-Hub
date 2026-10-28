import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Mã hóa AES-256-GCM cho thông tin nhận tiền (Module C).
 * - Khóa 32 byte (base64) lấy từ biến môi trường PAYOUT_ENC_KEY, CHỈ ở máy chủ (không NEXT_PUBLIC).
 * - Mỗi lần mã hóa dùng IV 12 byte ngẫu nhiên mới (không bao giờ dùng lại với cùng khóa).
 * - AAD (dữ liệu đi kèm được xác thực) buộc bản mã vào đúng dòng/chủ sở hữu: đem bản mã của dòng này
 *   dán sang dòng khác sẽ bị từ chối.
 * - Mọi lỗi giải mã đều trả cùng một thông báo chung, không lộ lý do cụ thể hay dữ liệu.
 * File này không import "server-only" để vitest chạy được; chỉ import từ code chạy ở máy chủ.
 */

export const KEY_BYTES = 32;
export const IV_BYTES = 12;
export const TAG_BYTES = 16;

export type Sealed = { ciphertext: string; iv: string; tag: string };

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

function fromB64(value: unknown, expectedBytes?: number): Buffer {
  if (typeof value !== "string" || value.length === 0 || value.length % 4 !== 0 || !B64.test(value)) {
    throw new CryptoError("Dữ liệu mã hóa không hợp lệ.");
  }
  const buf = Buffer.from(value, "base64");
  if (buf.toString("base64") !== value) throw new CryptoError("Dữ liệu mã hóa không hợp lệ.");
  if (expectedBytes !== undefined && buf.length !== expectedBytes) throw new CryptoError("Dữ liệu mã hóa không hợp lệ.");
  return buf;
}

/** Đọc và kiểm tra khóa: base64 chuẩn, đúng 32 byte, không phải khóa "đồng nhất" (toàn một giá trị byte). */
export function parseKey(raw: string | undefined | null): Buffer {
  const text = (raw ?? "").trim();
  if (!text) throw new CryptoError("Chưa cấu hình khóa mã hóa (PAYOUT_ENC_KEY).");
  let key: Buffer;
  try {
    key = fromB64(text, KEY_BYTES);
  } catch {
    throw new CryptoError("Khóa mã hóa (PAYOUT_ENC_KEY) không hợp lệ: cần chuỗi base64 của đúng 32 byte.");
  }
  if (key.every((b) => b === key[0])) {
    throw new CryptoError("Khóa mã hóa (PAYOUT_ENC_KEY) quá yếu: hãy tạo khóa ngẫu nhiên.");
  }
  return key;
}

/** Khóa hiện hành từ môi trường máy chủ. Ném CryptoError (thông báo tiếng Việt, không lộ khóa) nếu thiếu/sai. */
export function getPayoutKey(): Buffer {
  return parseKey(process.env.PAYOUT_ENC_KEY);
}

/** true nếu khóa đã được cấu hình đúng (dùng để hiện cảnh báo thân thiện thay vì lỗi 500). */
export function payoutKeyConfigured(): boolean {
  try {
    getPayoutKey();
    return true;
  } catch {
    return false;
  }
}

export function encrypt(plaintext: string, key: Buffer, aad?: string): Sealed {
  if (key.length !== KEY_BYTES) throw new CryptoError("Khóa mã hóa không hợp lệ.");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  if (aad !== undefined) cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: ct.toString("base64"), iv: iv.toString("base64"), tag: tag.toString("base64") };
}

export function decrypt(sealed: Sealed, key: Buffer, aad?: string): string {
  if (key.length !== KEY_BYTES) throw new CryptoError("Khóa mã hóa không hợp lệ.");
  try {
    const iv = fromB64(sealed.iv, IV_BYTES);
    const tag = fromB64(sealed.tag, TAG_BYTES); // GCM chấp nhận tag ngắn nếu không ép độ dài: luôn ép 16 byte
    // Bản rõ rỗng cho bản mã rỗng: chấp nhận chuỗi rỗng riêng cho trường này
    const ct = sealed.ciphertext === "" ? Buffer.alloc(0) : fromB64(sealed.ciphertext);
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    if (aad !== undefined) decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    throw new CryptoError("Không giải mã được thông tin (dữ liệu bị thay đổi hoặc sai khóa).");
  }
}

/** AAD chuẩn cho hồ sơ nhận tiền: gắn bản mã với id hồ sơ và id chủ sở hữu. */
export function payoutAad(profileId: string, ownerId: string): string {
  return `payout:v1:${profileId}:${ownerId}`;
}
