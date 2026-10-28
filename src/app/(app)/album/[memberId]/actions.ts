"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/format";
import { mediaErrorMessage } from "@/lib/media-core";

export type AlbumActionResult = { ok?: string; error?: string; id?: string };
const uuid = z.uuid();
const title = z.string().trim().min(1, "Vui lòng nhập tên album.").max(120, "Tên album quá dài.");
const visibility = z.enum(["family", "branch", "owner"]);

function fail(e: { code?: string; message?: string }): AlbumActionResult {
  return { error: mediaErrorMessage(e) ?? friendlyError(e) };
}
function bad(msg = "Thông tin chưa hợp lệ."): AlbumActionResult { return { error: msg }; }
const refresh = (memberId: string) => { revalidatePath(`/album/${memberId}`); revalidatePath("/album"); };

export async function ensureDefaultAlbumAction(memberId: string): Promise<AlbumActionResult> {
  await requireSession();
  if (!uuid.safeParse(memberId).success) return bad();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_default_album", { p_member: memberId });
  if (error) return fail(error);
  refresh(memberId);
  return { ok: "Đã sẵn sàng.", id: data as string };
}

export async function createAlbumAction(memberId: string, titleRaw: string, descRaw: string, vis: string): Promise<AlbumActionResult> {
  await requireSession();
  const t = title.safeParse(titleRaw), v = visibility.safeParse(vis);
  if (!uuid.safeParse(memberId).success || !v.success) return bad();
  if (!t.success) return bad(t.error.issues[0]?.message);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_album", {
    p_member: memberId, p_title: t.data, p_description: descRaw.trim().slice(0, 500) || null, p_visibility: v.data,
  });
  if (error) return fail(error);
  refresh(memberId);
  return { ok: "Đã tạo album.", id: data as string };
}

export async function updateAlbumAction(memberId: string, albumId: string, titleRaw: string, descRaw: string, vis: string): Promise<AlbumActionResult> {
  await requireSession();
  const t = title.safeParse(titleRaw), v = visibility.safeParse(vis);
  if (!uuid.safeParse(memberId).success || !uuid.safeParse(albumId).success || !v.success) return bad();
  if (!t.success) return bad(t.error.issues[0]?.message);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_album", {
    p_album: albumId, p_title: t.data, p_description: descRaw.trim().slice(0, 500) || null, p_visibility: v.data,
  });
  if (error) return fail(error);
  refresh(memberId);
  return { ok: "Đã lưu album." };
}

export async function deleteAlbumAction(memberId: string, albumId: string): Promise<AlbumActionResult> {
  await requireSession();
  if (!uuid.safeParse(memberId).success || !uuid.safeParse(albumId).success) return bad();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_album", { p_album: albumId });
  if (error) return fail(error);
  refresh(memberId);
  return { ok: "Đã xóa album." };
}

export async function updateItemAction(memberId: string, itemId: string, caption: string): Promise<AlbumActionResult> {
  await requireSession();
  if (!uuid.safeParse(memberId).success || !uuid.safeParse(itemId).success) return bad();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_album_item", { p_item: itemId, p_caption: caption.trim().slice(0, 300) });
  if (error) return fail(error);
  refresh(memberId);
  return { ok: "Đã lưu chú thích." };
}

export async function removeItemAction(memberId: string, itemId: string): Promise<AlbumActionResult> {
  await requireSession();
  if (!uuid.safeParse(memberId).success || !uuid.safeParse(itemId).success) return bad();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_album_item", { p_item: itemId });
  if (error) return fail(error);
  refresh(memberId);
  return { ok: "Đã xóa ảnh." };
}

export async function tagPersonAction(memberId: string, mediaId: string, personId: string, on: boolean): Promise<AlbumActionResult> {
  await requireSession();
  if (![memberId, mediaId, personId].every((x) => uuid.safeParse(x).success)) return bad();
  const supabase = await createClient();
  const { error } = await supabase.rpc(on ? "tag_media_person" : "untag_media_person", { p_media: mediaId, p_member: personId });
  if (error) return fail(error);
  refresh(memberId);
  return { ok: on ? "Đã gắn thẻ." : "Đã bỏ thẻ." };
}
