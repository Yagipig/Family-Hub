import { redirect } from "next/navigation";
import { requireAdmin, ROLE_LABELS, type Role } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { Alert, Card } from "@/components/ui";
import { ConfirmButton } from "@/components/SubmitButton";
import { revokeMembership, setMemberRole } from "./actions";

export const metadata = { title: "Tài khoản và quản trị viên" };

export default async function MembersAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireAdmin("/admin/quan-tri-vien");
  if (session.role === "branch_admin") redirect("/admin");
  const { ok, error } = await searchParams;
  const isSuper = session.role === "super_admin";
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("family_memberships")
    .select("id, user_id, role_key, branch_id, status, created_at")
    .order("created_at");
  const ids = (memberships ?? []).map((m) => m.user_id);
  const [{ data: profiles }, { data: branches }] = await Promise.all([
    supabase.from("user_profiles").select("id, display_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("branches").select("id, name").order("name"),
  ]);
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const branchOf = new Map((branches ?? []).map((b) => [b.id, b.name]));

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Tài khoản và quản trị viên</h1>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {isSuper && (
        <p className="text-base text-ink-soft">
          Để thêm admin phụ: vào mục Lời mời, chọn vai trò Quản trị gia đình hoặc Quản trị nhánh. Với người đã có tài khoản,
          dùng nút “Đổi vai trò” bên dưới.
        </p>
      )}
      <Card>
        <ul className="divide-y divide-champagne/50">
          {(memberships ?? []).map((m) => {
            const self = m.user_id === session.userId;
            const active = m.status === "active";
            return (
              <li key={m.id} className="space-y-3 py-4">
                <div>
                  <p className="text-base font-semibold">
                    {nameOf.get(m.user_id) ?? "(chưa đặt tên)"} {self && <span className="text-ink-soft">(bạn)</span>}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {ROLE_LABELS[m.role_key as Role]}
                    {m.branch_id ? ` · Nhánh ${branchOf.get(m.branch_id) ?? ""}` : ""}
                    {" · "}{active ? "Đang hoạt động" : "Đã thu hồi"} · Từ {formatDateTime(m.created_at, session.timezone)}
                  </p>
                </div>
                {active && !self && (
                  <div className="flex flex-wrap items-end gap-3">
                    {isSuper && (
                      <form action={setMemberRole} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={m.id} />
                        <label className="text-sm font-semibold">Vai trò mới
                          <select name="role" defaultValue={m.role_key === "super_admin" ? "family_admin" : m.role_key}
                            className="mt-1 block min-h-10 rounded-xl border border-ink-soft/40 bg-white px-3 text-base">
                            <option value="family_admin">Quản trị gia đình</option>
                            <option value="branch_admin">Quản trị nhánh</option>
                            <option value="member">Thành viên</option>
                            <option value="guest">Khách</option>
                          </select>
                        </label>
                        <label className="text-sm font-semibold">Nhánh (cho Quản trị nhánh)
                          <select name="branchId" defaultValue={m.branch_id ?? ""}
                            className="mt-1 block min-h-10 rounded-xl border border-ink-soft/40 bg-white px-3 text-base">
                            <option value="">—</option>
                            {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </label>
                        <ConfirmButton message="Đổi vai trò của tài khoản này?" className="min-h-10 rounded-xl border border-wine px-4 text-base font-semibold text-wine hover:bg-champagne-soft">
                          Đổi vai trò
                        </ConfirmButton>
                      </form>
                    )}
                    <form action={revokeMembership}>
                      <input type="hidden" name="id" value={m.id} />
                      <ConfirmButton message="Thu hồi quyền truy cập của tài khoản này? Họ sẽ mất quyền ngay lập tức."
                        className="min-h-10 rounded-xl border border-danger px-4 text-base font-semibold text-danger hover:bg-red-50">
                        Thu hồi quyền
                      </ConfirmButton>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
