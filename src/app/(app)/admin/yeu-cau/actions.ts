"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { memberError } from "@/lib/members-errors";
import { reviewSchema } from "@/lib/members-schemas";

const BASE = "/admin/yeu-cau";
const back = (kind: "ok" | "error", msg: string, status?: string): never =>
  redirect(`${BASE}?${status ? `status=${status}&` : ""}${kind}=${encodeURIComponent(msg)}`);

export async function reviewRequestAction(formData: FormData) {
  await requireAdmin(BASE);
  const parsed = reviewSchema.safeParse({ id: formData.get("id"), decision: formData.get("decision"), note: String(formData.get("note") ?? "") });
  if (!parsed.success) return back("error", parsed.error.issues[0]?.message ?? "Yêu cầu không hợp lệ.");
  const approve = parsed.data.decision === "approve";
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_change_request", { p_id: parsed.data.id, p_approve: approve, p_note: parsed.data.note });
  // Duyệt lỗi (ví dụ tạo vòng lặp) thì yêu cầu vẫn ở trạng thái chờ: toàn bộ thay đổi được hoàn tác ở CSDL
  if (error) return back("error", memberError(error));
  revalidatePath(BASE);
  revalidatePath("/thanh-vien");
  revalidatePath("/gia-pha");
  return back("ok", approve ? "Đã duyệt và áp dụng thay đổi." : "Đã từ chối yêu cầu.");
}
