import { requireAdmin, ROLE_LABELS, type Role } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { Alert, Card } from "@/components/ui";
import { ConfirmButton } from "@/components/SubmitButton";
import { InviteForm } from "./InviteForm";
import { revokeInvitation } from "./actions";

export const metadata = { title: "Lời mời" };

const STATUS: Record<string, string> = { pending: "Đang chờ", accepted: "Đã dùng", revoked: "Đã thu hồi" };

export default async function InvitationsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireAdmin("/admin/loi-moi");
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: invitations }, { data: branches }] = await Promise.all([
    supabase.from("invitations").select("id, email, role_key, branch_id, expires_at, used_count, max_uses, status, created_at")
      .order("created_at", { ascending: false }).limit(100),
    supabase.from("branches").select("id, name").order("name"),
  ]);
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  // Quản trị nhánh chỉ được chọn nhánh của mình ở giao diện; DB vẫn kiểm tra lại.
  const selectable = session.role === "branch_admin"
    ? (branches ?? []).filter((b) => b.id === session.branchId)
    : (branches ?? []);

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Lời mời</h1>
      {error && error !== "1" && <Alert kind="error">{error}</Alert>}
      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Tạo lời mời mới</h2>
        <InviteForm branches={selectable} isSuperAdmin={session.role === "super_admin"} />
      </Card>
      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Lời mời đã tạo</h2>
        {(invitations ?? []).length === 0 ? (
          <p className="text-base text-ink-soft">Chưa có lời mời nào.</p>
        ) : (
          <ul className="divide-y divide-champagne/50">
            {invitations!.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold">{i.email ?? "Chỉ liên kết"} · {ROLE_LABELS[i.role_key as Role]}</p>
                  <p className="text-sm text-ink-soft">
                    {STATUS[i.status] ?? i.status} · Hết hạn {formatDateTime(i.expires_at, session.timezone)}
                    {i.branch_id ? ` · Nhánh ${branchName.get(i.branch_id) ?? ""}` : ""}
                  </p>
                </div>
                {i.status === "pending" && (
                  <form action={revokeInvitation}>
                    <input type="hidden" name="id" value={i.id} />
                    <ConfirmButton message="Thu hồi lời mời này?" className="min-h-10 rounded-xl border border-danger px-4 text-base font-semibold text-danger hover:bg-red-50">
                      Thu hồi
                    </ConfirmButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
