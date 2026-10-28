import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { CryptoError, decrypt, encrypt, getPayoutKey, payoutAad } from "@/lib/crypto";
import { cardsError } from "@/lib/cards";
import { last4Of, parseSecret, toSecret, type PayoutInput, type PayoutSecret } from "@/lib/payout";

/**
 * Lớp máy chủ cho thông tin nhận tiền. Mã hóa/giải mã CHỈ diễn ra ở đây (khóa PAYOUT_ENC_KEY chỉ có ở máy chủ).
 * Trình duyệt chỉ nhận bản rõ khi người dùng bấm "Hiện" và DB cho phép (chủ hồ sơ hoặc người đang được chia sẻ).
 */

export type PayoutError = { ok: false; error: string };

function keyOrError(): { key: Buffer } | PayoutError {
  try {
    return { key: getPayoutKey() };
  } catch (e) {
    return { ok: false, error: e instanceof CryptoError ? e.message : "Chưa cấu hình khóa mã hóa." };
  }
}

export async function createPayoutProfile(familyId: string, ownerId: string, input: PayoutInput): Promise<{ ok: true } | PayoutError> {
  const k = keyOrError();
  if ("ok" in k) return k;
  const id = randomUUID();
  const sealed = encrypt(JSON.stringify(toSecret(input)), k.key, payoutAad(id, ownerId));
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_payout_profile", {
    p_id: id,
    p_family: familyId,
    p_kind: input.kind,
    p_label: input.label,
    p_last4: last4Of(input.number),
    p_ciphertext: sealed.ciphertext,
    p_iv: sealed.iv,
    p_tag: sealed.tag,
    p_key_version: 1,
  });
  if (error) return { ok: false, error: cardsError(error) };
  return { ok: true };
}

/**
 * Lấy bản mã qua RPC (DB kiểm tra chủ/được chia sẻ chưa hết hạn/chưa thu hồi và GHI NHẬT KÝ payout.reveal),
 * rồi giải mã ở máy chủ. Không bao giờ cache; không ghi log nội dung.
 */
export async function revealPayoutProfile(profileId: string): Promise<{ ok: true; secret: PayoutSecret } | PayoutError> {
  const k = keyOrError();
  if ("ok" in k) return k;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reveal_payout_profile", { p_profile: profileId });
  if (error) {
    return { ok: false, error: error.code === "42501" ? "Bạn không (còn) được xem thông tin này. Có thể lượt chia sẻ đã hết hạn hoặc bị thu hồi." : cardsError(error) };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: "Không tìm thấy thông tin." };
  try {
    const plain = decrypt({ ciphertext: row.ciphertext, iv: row.iv, tag: row.tag }, k.key, payoutAad(row.id, row.owner_id));
    return { ok: true, secret: parseSecret(plain) };
  } catch {
    return { ok: false, error: "Không giải mã được thông tin này (dữ liệu hoặc khóa không khớp). Hãy báo quản trị viên." };
  }
}
