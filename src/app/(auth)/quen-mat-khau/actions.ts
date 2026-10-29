"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
import type { FormState } from "@/lib/schemas";

const emailSchema = z.email("Email chưa hợp lệ").max(254).transform((v) => v.toLowerCase());

/**
 * Gui email dat lai mat khau. Luon tra ve thanh cong (ke ca khi email chua co tai khoan)
 * de khong lo thong tin email nao da dang ky; loi gui that chi ghi nhan khi dinh dang sai.
 */
export async function sendReset(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Email chưa hợp lệ." };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : siteUrl();

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/dat-lai-mat-khau`,
  });
  return { ok: "Đã gửi! Hãy mở hộp thư (cả mục Thư rác/Spam) và bấm vào liên kết trong email để đặt mật khẩu mới. Liên kết chỉ dùng được trong thời gian ngắn — nếu hết hạn, quay lại đây gửi lại." };
}
