import Link from "next/link";
import { redirect } from "next/navigation";
import { can, requireAdmin, ROLE_LABELS, type Role } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, buttonGhostClass } from "@/components/ui";
import { AccountLinker, type LinkerAccount } from "@/components/AccountLinker";
import { loadBranches, loadPickerMembers } from "@/lib/members-data";
import { foldVietnamese } from "@/lib/members-text";
import { linkAccountAction, unlinkAccountAction } from "./actions";

export const metadata = { title: "Gắn tài khoản với hồ sơ" };

export default async function LinkAccountsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; filter?: string }> }) {
  const session = await requireAdmin("/admin/gan-ho-so");
  // Quyền thật là 'roles','update' (RPC kiểm tra lại); chặn sớm để quản trị nhánh không thấy trang vô dụng
  if (!(await can(session, "roles", "update"))) redirect("/admin");
  const { ok, error, filter } = await searchParams;
  const mode = filter === "linked" || filter === "all" ? filter : "unlinked";
  const supabase = await createClient();

  const { data: ms } = await supabase.from("family_memberships")
    .select("id, user_id, role_key, branch_id, member_id").eq("status", "active").order("created_at");
  const memberships = (ms ?? []) as { id: string; user_id: string; role_key: Role; branch_id: string | null; member_id: string | null }[];
  const userIds = memberships.map((m) => m.user_id);
  const [branches, { data: profiles }] = await Promise.all([
    loadBranches(supabase),
    userIds.length ? supabase.from("user_profiles").select("id, display_name").in("id", userIds) : Promise.resolve({ data: [] }),
  ]);
  const members = await loadPickerMembers(supabase, branches);
  const nameOfUser = new Map(((profiles ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
  const nameOfMember = new Map(members.map((m) => [m.id, m.name]));
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const linked = new Set(memberships.map((m) => m.member_id).filter((x): x is string => !!x));

  const accounts: LinkerAccount[] = memberships
    .filter((m) => mode === "all" || (mode === "linked" ? !!m.member_id : !m.member_id))
    .map((m) => {
      const display = nameOfUser.get(m.user_id) ?? "(chưa đặt tên)";
      const key = foldVietnamese(display);
      const match = m.member_id ? null : members.filter((x) => !linked.has(x.id) && foldVietnamese(x.name) === key);
      return {
        membershipId: m.id, name: display, roleLabel: ROLE_LABELS[m.role_key], branchName: m.branch_id ? (branchName.get(m.branch_id) ?? null) : null,
        memberId: m.member_id, memberName: m.member_id ? (nameOfMember.get(m.member_id) ?? null) : null,
        // Chỉ gợi ý khi có đúng MỘT hồ sơ trùng tên (tránh gắn nhầm)
        suggestion: match && match.length === 1 ? { id: match[0].id, name: match[0].name } : null,
      };
    });
  const unlinkedCount = memberships.filter((m) => !m.member_id).length;
  const tab = (key: string, label: string) => (
    <Link href={`/admin/gan-ho-so?filter=${key}`} aria-current={mode === key ? "page" : undefined}
      className={`${buttonGhostClass} ${mode === key ? "!bg-wine !text-white" : ""}`}>{label}</Link>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-3xl font-bold text-wine">Gắn tài khoản với hồ sơ</h1>
        <Link href="/admin" className={buttonGhostClass}>Về Quản trị</Link>
      </div>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      <p className="text-base text-ink-soft">
        Mỗi tài khoản gắn với tối đa một hồ sơ thành viên, và mỗi hồ sơ gắn với tối đa một tài khoản. Hồ sơ đã gắn giúp người đó luôn xem và sửa được thông tin của chính mình,
        cũng như nhận thông báo sinh nhật, ngày giỗ đúng người. Có {unlinkedCount} tài khoản chưa gắn hồ sơ.
      </p>
      <nav aria-label="Lọc tài khoản" className="flex flex-wrap gap-2">
        {tab("unlinked", "Chưa gắn")}{tab("linked", "Đã gắn")}{tab("all", "Tất cả")}
      </nav>
      <Card>
        {accounts.length === 0 ? <p className="text-base text-ink-soft">Không có tài khoản nào trong mục này.</p>
          : <AccountLinker accounts={accounts} members={members} linkAction={linkAccountAction} unlinkAction={unlinkAccountAction} />}
      </Card>
    </>
  );
}
