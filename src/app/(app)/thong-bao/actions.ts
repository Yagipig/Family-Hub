"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Đánh dấu đã đọc rồi mở liên kết (chỉ liên kết nội bộ). Liên kết lấy từ CSDL của chính người dùng, không từ form. */
export async function openNotification(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) redirect("/thong-bao");
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("link").eq("id", id).maybeSingle();
  await supabase.rpc("mark_notifications_read", { p_ids: [id] });
  revalidatePath("/", "layout");
  redirect(data?.link ? safeNext(data.link as string) : "/thong-bao");
}

export async function markOneRead(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", { p_ids: [id] });
  revalidatePath("/", "layout");
}

export async function markAllRead(): Promise<void> {
  await requireSession();
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", { p_ids: null });
  revalidatePath("/", "layout");
}
