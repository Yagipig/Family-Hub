"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/format";

const BASE = "/admin/quan-tri-vien";
const back = (kind: "ok" | "error", msg: string): never => redirect(`${BASE}?${kind}=${encodeURIComponent(msg)}`);

export async function revokeMembership(formData: FormData) {
  await requireAdmin(BASE);
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return back("error", "Yêu cầu không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_membership", { p_membership: id.data });
  if (error) return back("error", friendlyError(error));
  revalidatePath(BASE);
  return back("ok", "Đã thu hồi quyền truy cập. Tài khoản này mất quyền ngay lập tức.");
}

export async function setMemberRole(formData: FormData) {
  await requireAdmin(BASE);
  const parsed = z.object({
    id: z.uuid(),
    role: z.enum(["family_admin", "branch_admin", "member", "guest"]),
    branchId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
  }).safeParse({ id: formData.get("id"), role: formData.get("role"), branchId: formData.get("branchId") ?? "" });
  if (!parsed.success) return back("error", "Yêu cầu không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    p_membership: parsed.data.id, p_role: parsed.data.role, p_branch: parsed.data.branchId,
  });
  if (error) return back("error", friendlyError(error));
  revalidatePath(BASE);
  return back("ok", "Đã đổi vai trò.");
}
