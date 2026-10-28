"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/format";
import { mediaErrorMessage } from "@/lib/media-core";

export type MediaActionResult = { ok?: string; error?: string };
const uuid = z.uuid();

/** Đặt ảnh đại diện (media đã tải lên bằng /api/media/upload với kind=avatar). Quyền do CSDL kiểm tra (chủ hồ sơ hoặc người được sửa hồ sơ). */
export async function setMemberAvatarAction(memberId: string, mediaId: string): Promise<MediaActionResult> {
  await requireSession();
  if (!uuid.safeParse(memberId).success || !uuid.safeParse(mediaId).success) return { error: "Thông tin chưa hợp lệ." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_avatar", { p_member: memberId, p_media: mediaId });
  if (error) return { error: mediaErrorMessage(error) ?? friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: "Đã cập nhật ảnh đại diện." };
}

export async function clearMemberAvatarAction(memberId: string): Promise<MediaActionResult> {
  await requireSession();
  if (!uuid.safeParse(memberId).success) return { error: "Thông tin chưa hợp lệ." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_avatar", { p_member: memberId, p_media: null });
  if (error) return { error: mediaErrorMessage(error) ?? friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: "Đã gỡ ảnh đại diện." };
}
