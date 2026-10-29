"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { inviteSchema, type FormState } from "@/lib/schemas";

export async function createInvitation(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdmin("/admin/loi-moi");
  const parsed = inviteSchema.safeParse({
    email: formData.get("email") ?? "",
    role: formData.get("role"),
    branchId: formData.get("branchId") ?? "",
    ttlHours: formData.get("ttlHours"),
    maxUses: formData.get("maxUses") ?? 1,
  });
  if (!parsed.success) return { error: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại." };

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_invitation", {
    p_family: session.familyId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_branch: parsed.data.branchId,
    p_member_id: null,
    p_ttl_hours: parsed.data.ttlHours,
    p_max_uses: parsed.data.maxUses,
  });
  if (error || typeof token !== "string") return { error: friendlyError(error) };
  revalidatePath("/admin/loi-moi");
  return {
    ok: parsed.data.maxUses > 1
      ? "Đã tạo liên kết mời dùng chung. Gửi liên kết này cho cả nhà — ai mở ra cũng đăng ký tham gia được."
      : "Đã tạo lời mời. Hãy sao chép liên kết dưới đây và gửi riêng cho người nhận (Zalo, LINE…).",
    link: `${siteUrl()}/moi/${token}`,
  };
}

export async function revokeInvitation(formData: FormData) {
  await requireAdmin("/admin/loi-moi");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) redirect("/admin/loi-moi?error=1");
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation: id });
  if (error) redirect(`/admin/loi-moi?error=${encodeURIComponent(friendlyError(error))}`);
  revalidatePath("/admin/loi-moi");
  redirect("/admin/loi-moi");
}
