"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/format";
import { mediaErrorMessage } from "@/lib/media-core";

const BASE = "/admin/anh-bia";
export type CoverResult = { ok?: string; error?: string };

export async function setCoverAction(mediaId: string | null): Promise<CoverResult> {
  const session = await requireAdmin(BASE);
  if (mediaId !== null && !z.uuid().safeParse(mediaId).success) return { error: "Thông tin chưa hợp lệ." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_family_cover", { p_family: session.familyId, p_media: mediaId });
  if (error) return { error: mediaErrorMessage(error) ?? friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: mediaId ? "Đã đặt ảnh bìa mới cho cả gia đình." : "Đã gỡ ảnh bìa." };
}

/** Chỉ Super Admin (CSDL kiểm tra). Nhận số MB, đổi sang byte. */
export async function setQuotaAction(megabytes: number): Promise<CoverResult> {
  const session = await requireAdmin(BASE);
  const mb = z.number().int().min(50).max(102_400).safeParse(megabytes);
  if (!mb.success) return { error: "Dung lượng phải từ 50 MB đến 100 GB (102400 MB)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_media_quota", { p_family: session.familyId, p_bytes: mb.data * 1024 * 1024 });
  if (error) return { error: error.code === "42501" ? "Chỉ Super Admin được đổi hạn mức dung lượng." : friendlyError(error) };
  revalidatePath(BASE);
  return { ok: "Đã cập nhật hạn mức dung lượng ảnh." };
}
