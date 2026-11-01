import { can, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui";
import { FamilyTreeExplorer } from "@/components/FamilyTreeExplorer";
import { loadBranches, loadFamilyAccounts, loadTreeData, UUID_RE } from "@/lib/members-data";

export const metadata = { title: "Cây gia phả" };
export const dynamic = "force-dynamic";

export default async function FamilyTreePage({ searchParams }: { searchParams: Promise<{ focus?: string; ok?: string; error?: string }> }) {
  const session = await requireSession();
  const { focus, ok, error } = await searchParams;
  const supabase = await createClient();
  // Admin (quyền sửa thành viên) là người sắp xếp thứ tự anh chị em trên cây
  const canArrange = await can(session, "members", "update");

  let data: Awaited<ReturnType<typeof loadTreeData>> | null = null;
  try { data = await loadTreeData(supabase); } catch { data = null; }
  const [branches, mine] = await Promise.all([
    loadBranches(supabase),
    supabase.from("family_memberships").select("member_id").eq("user_id", session.userId).eq("status", "active").maybeSingle(),
  ]);
  const selfId = (mine.data as { member_id: string | null } | null)?.member_id ?? null;
  // Quản trị (quyền đổi vai trò) được chọn người ĐÃ ĐĂNG KÝ chưa có hồ sơ trong nút + để tạo hồ sơ cho họ
  const canLink = await can(session, "roles", "update");
  const unlinkedAccounts = canLink
    ? (await loadFamilyAccounts(supabase)).filter((a) => !a.memberId).map((a) => ({ membershipId: a.membershipId, name: a.name }))
    : [];
  const wanted = focus && UUID_RE.test(focus) ? focus : null;
  // Không có ?focus thì bắt đầu ở hồ sơ của chính mình (nếu đã được gắn)
  const initialFocus = wanted ?? selfId;

  return (
    <>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {!data ? <Alert kind="error">Không tải được dữ liệu gia phả. Vui lòng thử lại sau.</Alert> : (
        <FamilyTreeExplorer
          familyName={session.familyName}
          people={data.people} links={data.links} partners={data.partners} branches={branches}
          initialFocusId={initialFocus && data.people.some((p) => p.id === initialFocus) ? initialFocus : null}
          selfId={selfId} canEdit={session.role !== "guest"} canArrange={canArrange}
          unlinkedAccounts={unlinkedAccounts}
        />
      )}
    </>
  );
}
