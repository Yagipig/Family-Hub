"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chatError } from "@/lib/chat";
import { idSchema, renameSchema } from "@/lib/chat-schemas";

const roomBase = (id: string) => `/tin-nhan/${id}/thanh-vien`;
const back = (id: string, kind: "ok" | "error", msg: string): never =>
  redirect(`${roomBase(id)}?${kind}=${encodeURIComponent(msg)}`);

function ids(formData: FormData, ...keys: string[]): string[] | null {
  const out: string[] = [];
  for (const k of keys) {
    const parsed = idSchema.safeParse(formData.get(k));
    if (!parsed.success) return null;
    out.push(parsed.data);
  }
  return out;
}

export async function setMuted(formData: FormData) {
  await requireSession();
  const parsed = ids(formData, "id");
  if (!parsed) redirect("/tin-nhan");
  const [id] = parsed!;
  const muted = formData.get("muted") === "1";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_conversation_muted", { p_conversation: id, p_muted: muted });
  if (error) return back(id, "error", chatError(error));
  revalidatePath("/tin-nhan");
  return back(id, "ok", muted ? "Đã tắt thông báo cho cuộc trò chuyện này." : "Đã bật lại thông báo.");
}

export async function renameGroup(formData: FormData) {
  await requireSession();
  const parsed = ids(formData, "id");
  if (!parsed) redirect("/tin-nhan");
  const [id] = parsed!;
  const title = renameSchema.safeParse({ title: formData.get("title") });
  if (!title.success) return back(id, "error", title.error.issues[0]?.message ?? "Tên nhóm chưa hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_conversation", { p_conversation: id, p_title: title.data.title });
  if (error) return back(id, "error", chatError(error));
  revalidatePath("/tin-nhan");
  return back(id, "ok", "Đã đổi tên nhóm.");
}

export async function addMember(formData: FormData) {
  await requireSession();
  const parsed = ids(formData, "id", "userId");
  if (!parsed) {
    const only = ids(formData, "id");
    return only ? back(only[0], "error", "Hãy chọn một người để thêm.") : redirect("/tin-nhan");
  }
  const [id, userId] = parsed;
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_conversation_member", { p_conversation: id, p_user: userId });
  if (error) return back(id, "error", chatError(error));
  revalidatePath(roomBase(id));
  return back(id, "ok", "Đã thêm thành viên vào cuộc trò chuyện.");
}

export async function removeMember(formData: FormData) {
  await requireSession();
  const parsed = ids(formData, "id", "userId");
  if (!parsed) redirect("/tin-nhan");
  const [id, userId] = parsed!;
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_conversation_member", { p_conversation: id, p_user: userId });
  if (error) return back(id, "error", chatError(error));
  revalidatePath(roomBase(id));
  return back(id, "ok", "Đã gỡ thành viên khỏi cuộc trò chuyện.");
}

export async function leaveGroup(formData: FormData) {
  await requireSession();
  const parsed = ids(formData, "id");
  if (!parsed) redirect("/tin-nhan");
  const [id] = parsed!;
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_conversation", { p_conversation: id });
  if (error) return back(id, "error", chatError(error));
  revalidatePath("/tin-nhan");
  redirect(`/tin-nhan?ok=${encodeURIComponent("Bạn đã rời nhóm.")}`);
}

export async function blockUser(formData: FormData) {
  const session = await requireSession();
  const parsed = ids(formData, "id", "userId");
  if (!parsed) redirect("/tin-nhan");
  const [id, userId] = parsed!;
  const supabase = await createClient();
  const { error } = await supabase.rpc("block_chat_user", { p_family: session.familyId, p_user: userId });
  if (error) return back(id, "error", chatError(error));
  revalidatePath("/tin-nhan");
  return back(id, "ok", "Đã chặn. Người này không nhắn riêng cho bạn được nữa (nhóm chung vẫn bình thường).");
}

export async function unblockUser(formData: FormData) {
  await requireSession();
  const parsed = ids(formData, "id", "userId");
  if (!parsed) redirect("/tin-nhan");
  const [id, userId] = parsed!;
  const supabase = await createClient();
  const { error } = await supabase.rpc("unblock_chat_user", { p_user: userId });
  if (error) return back(id, "error", chatError(error));
  revalidatePath("/tin-nhan");
  return back(id, "ok", "Đã bỏ chặn.");
}
