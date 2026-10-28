"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chatError } from "@/lib/chat";
import { resolveSchema } from "@/lib/chat-schemas";

const BASE = "/admin/bao-cao";
const back = (kind: "ok" | "error", msg: string): never => redirect(`${BASE}?${kind}=${encodeURIComponent(msg)}`);

const DONE: Record<string, string> = {
  dismiss: "Đã bỏ qua báo cáo (tin nhắn giữ nguyên).",
  hide_message: "Đã ẩn tin nhắn bị báo cáo.",
  remove_member: "Đã gỡ thành viên khỏi nhóm.",
  hide_and_remove: "Đã ẩn tin nhắn và gỡ thành viên khỏi nhóm.",
};

export async function resolveReport(formData: FormData) {
  await requireAdmin(BASE);
  const parsed = resolveSchema.safeParse({
    report: formData.get("report"),
    action: formData.get("decision"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return back("error", parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_report", {
    p_report: parsed.data.report, p_action: parsed.data.action, p_note: parsed.data.note?.trim() || null,
  });
  if (error) return back("error", chatError(error));
  revalidatePath(BASE);
  return back("ok", DONE[parsed.data.action]);
}
