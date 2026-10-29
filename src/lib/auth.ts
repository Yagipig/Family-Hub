import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "super_admin" | "family_admin" | "branch_admin" | "member" | "guest";
export const ADMIN_ROLES: Role[] = ["super_admin", "family_admin", "branch_admin"];
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  family_admin: "Quản trị gia đình",
  branch_admin: "Quản trị nhánh",
  member: "Thành viên",
  guest: "Khách (hạn chế)",
};

export type Session = {
  userId: string;
  email: string;
  displayName: string;
  familyId: string;
  familyName: string;
  timezone: string;
  role: Role;
  branchId: string | null;
};

/**
 * Người dùng đã được máy chủ Supabase xác minh (gọi auth.getUser một vòng mạng),
 * được cache() để trong cùng một request chỉ gọi TỐI ĐA một lần dù layout,
 * trang và các component cùng cần. Trước đây requireSession gọi getUser riêng,
 * rồi getSession lại gọi lần nữa — hai vòng mạng nối tiếp cho cùng một kết quả.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/**
 * Lấy phiên đã được máy chủ Supabase xác minh + thành viên đang hoạt động.
 * Tài khoản bị thu hồi (status = revoked) không có dòng active => trả về null ngay.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  // Hai truy vấn độc lập (chỉ phụ thuộc user.id): chạy song song thay vì nối tiếp.
  const [{ data: m }, { data: profile }] = await Promise.all([
    supabase
      .from("family_memberships")
      .select("family_id, role_key, branch_id, families(name, timezone)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase.from("user_profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!m) return null;

  const fam = m.families as unknown as { name: string; timezone: string } | null;
  return {
    userId: user.id,
    email: user.email ?? "",
    displayName: profile?.display_name ?? user.email ?? "",
    familyId: m.family_id,
    familyName: fam?.name ?? "Family Hub",
    timezone: fam?.timezone ?? "Asia/Ho_Chi_Minh",
    role: m.role_key as Role,
    branchId: m.branch_id,
  };
});

/** Dùng ở đầu mỗi trang/Server Action cần đăng nhập. */
export async function requireSession(): Promise<Session> {
  const user = await getAuthUser();
  if (!user) redirect("/dang-nhap");
  const session = await getSession();
  if (!session) redirect("/khong-co-quyen");
  return session;
}

/**
 * Kiểm tra quyền qua RPC has_permission — mỗi lần gọi là một vòng mạng sang Supabase.
 * cache() theo đúng bộ tham số trong cùng một request: layout và trang chủ trước đây
 * cùng kiểm tra lại các module giống nhau (lên tới ~9 RPC nối tiếp mỗi lần tải trang),
 * giờ các lần trùng chỉ còn tốn bộ nhớ đệm.
 */
export const can = cache(
  async (
    session: Session,
    module: string,
    action: "view" | "create" | "update" | "delete" | "approve" | "export",
    branchId?: string | null,
  ): Promise<boolean> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("has_permission", {
      p_family: session.familyId,
      p_module: module,
      p_action: action,
      p_branch: branchId ?? null,
    });
    return !error && data === true;
  },
);

/**
 * Trang admin: phải là vai trò quản trị VÀ đã xác thực hai lớp (MFA, aal2).
 * Chưa đăng ký MFA => chuyển tới trang thiết lập; đã có nhưng chưa nhập mã => trang nhập mã.
 */
export async function requireAdmin(next: string): Promise<Session> {
  const session = await requireSession();
  if (!ADMIN_ROLES.includes(session.role)) redirect("/");
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel !== "aal2") {
    if (data?.nextLevel === "aal2") redirect(`/mfa?next=${encodeURIComponent(next)}`);
    redirect("/cai-dat/bao-mat?required=1");
  }
  return session;
}

/** Chỉ cho phép chuyển hướng nội bộ. */
export function safeNext(next: string | undefined | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
