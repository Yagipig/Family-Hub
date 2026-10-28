"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/format";

const BASE = "/admin/kiem-duyet";
const back = (kind: "ok" | "error", msg: string): never => redirect(`${BASE}?${kind}=${encodeURIComponent(msg)}`);

export async function resolveReportAction(formData: FormData) {
  await requireAdmin(BASE);
  const id = z.uuid().safeParse(formData.get("report"));
  const action = z.enum(["hide", "delete", "dismiss"]).safeParse(formData.get("action"));
  if (!id.success || !action.success) return back("error", "Thông tin chưa hợp lệ.");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_post_report", { p_report: id.data, p_action: action.data, p_note: note || null });
  if (error) return back("error", error.code === "P0002" ? "Báo cáo này đã được xử lý." : friendlyError(error));
  revalidatePath(BASE); revalidatePath("/bang-tin");
  return back("ok", action.data === "dismiss" ? "Đã bỏ qua báo cáo." : action.data === "hide" ? "Đã ẩn nội dung bị báo cáo." : "Đã xóa nội dung bị báo cáo.");
}

export async function unhidePostAction(formData: FormData) {
  await requireAdmin(BASE);
  const id = z.uuid().safeParse(formData.get("post"));
  if (!id.success) return back("error", "Thông tin chưa hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("unhide_post", { p_post: id.data });
  if (error) return back("error", friendlyError(error));
  revalidatePath(BASE); revalidatePath("/bang-tin");
  return back("ok", "Đã hiện lại bài viết.");
}
