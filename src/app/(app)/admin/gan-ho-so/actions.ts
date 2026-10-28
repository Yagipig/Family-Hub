"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { memberError } from "@/lib/members-errors";
import { idSchema } from "@/lib/members-schemas";

const BASE = "/admin/gan-ho-so";
const back = (kind: "ok" | "error", msg: string): never => redirect(`${BASE}?${kind}=${encodeURIComponent(msg)}`);

export async function linkAccountAction(formData: FormData) {
  await requireAdmin(BASE);
  const membership = idSchema.safeParse(formData.get("membershipId"));
  const member = idSchema.safeParse(formData.get("memberId"));
  if (!membership.success) return back("error", "Yêu cầu không hợp lệ.");
  if (!member.success) return back("error", "Hãy chọn một hồ sơ trong danh sách trước khi gắn.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_membership_member", { p_membership: membership.data, p_member: member.data });
  if (error) return back("error", memberError(error));
  revalidatePath(BASE);
  revalidatePath("/thanh-vien");
  return back("ok", "Đã gắn tài khoản với hồ sơ.");
}

export async function unlinkAccountAction(formData: FormData) {
  await requireAdmin(BASE);
  const membership = idSchema.safeParse(formData.get("membershipId"));
  if (!membership.success) return back("error", "Yêu cầu không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_membership_member", { p_membership: membership.data, p_member: null });
  if (error) return back("error", memberError(error));
  revalidatePath(BASE);
  revalidatePath("/thanh-vien");
  return back("ok", "Đã gỡ liên kết tài khoản với hồ sơ.");
}
