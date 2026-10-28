"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/format";
import { branchSchema, editingSchema, familySettingsSchema } from "@/lib/schemas";

const BASE = "/admin/gia-dinh";
const back = (kind: "ok" | "error", msg: string): never => redirect(`${BASE}?${kind}=${encodeURIComponent(msg)}`);

export async function updateFamily(formData: FormData) {
  const session = await requireAdmin(BASE);
  const parsed = familySettingsSchema.safeParse({
    name: formData.get("name"), primaryColor: formData.get("primaryColor") ?? "", timezone: formData.get("timezone"),
  });
  if (!parsed.success) return back("error", parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("families")
    .update({ name: parsed.data.name, primary_color: parsed.data.primaryColor, timezone: parsed.data.timezone })
    .eq("id", session.familyId).select("id");
  if (error || !data?.length) return back("error", "Bạn không có quyền sửa thông tin gia đình.");
  revalidatePath("/", "layout");
  return back("ok", "Đã lưu thông tin gia đình.");
}

export async function addBranch(formData: FormData) {
  const session = await requireAdmin(BASE);
  const parsed = branchSchema.safeParse({ name: formData.get("name"), parentId: formData.get("parentId") ?? "" });
  if (!parsed.success) return back("error", "Tên nhánh chưa hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.from("branches")
    .insert({ family_id: session.familyId, name: parsed.data.name, parent_branch_id: parsed.data.parentId });
  if (error) return back("error", "Bạn không có quyền thêm nhánh hoặc thông tin chưa hợp lệ.");
  revalidatePath(BASE);
  return back("ok", "Đã thêm nhánh họ.");
}

export async function setEditing(formData: FormData) {
  const session = await requireAdmin(BASE);
  const parsed = editingSchema.safeParse({
    scope: formData.get("scope"), mode: formData.get("mode"), hours: formData.get("hours") ?? 0,
  });
  if (!parsed.success) return back("error", "Thông tin chưa hợp lệ.");
  const until = parsed.data.mode === "open" && parsed.data.hours > 0
    ? new Date(Date.now() + parsed.data.hours * 3600_000).toISOString() : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_editing_mode", {
    p_family: session.familyId,
    p_branch: parsed.data.scope === "family" ? null : parsed.data.scope,
    p_mode: parsed.data.mode,
    p_until: until,
  });
  if (error) return back("error", friendlyError(error));
  revalidatePath(BASE);
  return back("ok", parsed.data.mode === "open" ? "Đã mở khóa chỉnh sửa." : "Đã khóa chỉnh sửa.");
}
