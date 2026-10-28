"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { handleDataRequestSchema } from "@/lib/data-requests";

const BASE = "/admin/yeu-cau-du-lieu";
const back = (kind: "ok" | "error", msg: string): never => redirect(`${BASE}?${kind}=${encodeURIComponent(msg)}`);

export async function handleRequest(formData: FormData) {
  await requireAdmin(BASE);
  const parsed = handleDataRequestSchema.safeParse({ id: formData.get("id"), status: formData.get("status"), note: formData.get("note") ?? "" });
  if (!parsed.success) return back("error", "Thông tin chưa hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("handle_data_request", { p_id: parsed.data.id, p_status: parsed.data.status, p_note: parsed.data.note || null });
  if (error) return back("error", error.code === "42501" ? "Bạn không có quyền xử lý yêu cầu này." : "Không xử lý được (yêu cầu có thể đã xong).");
  revalidatePath(BASE);
  return back("ok", "Đã cập nhật yêu cầu và báo cho người gửi.");
}
