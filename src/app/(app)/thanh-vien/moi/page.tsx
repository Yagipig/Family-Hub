import Link from "next/link";
import { ADMIN_ROLES, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, buttonGhostClass } from "@/components/ui";
import { MemberForm } from "@/components/MemberForm";
import { canEditMembers, loadBranches, loadMember } from "@/lib/members-data";
import { emptyValues } from "@/lib/members-form";
import { idSchema } from "@/lib/members-schemas";
import { createMemberAction, requestCreateMemberAction } from "../actions";

export const metadata = { title: "Thêm thành viên" };

export default async function NewMemberPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  if (session.role === "guest") {
    return (
      <>
        <h1 className="text-3xl font-bold text-wine">Thêm thành viên</h1>
        <Alert kind="error">Tài khoản khách chỉ được xem, không thể thêm thành viên.</Alert>
        <Link href="/thanh-vien" className={buttonGhostClass}>Quay lại danh sách</Link>
      </>
    );
  }
  const sp = await searchParams;
  const supabase = await createClient();
  const branches = await loadBranches(supabase);

  // “Thêm con / cha mẹ / vợ chồng” từ hồ sơ của một người: ?rel=child|parent|partner&to=<id>
  const relRaw = typeof sp.rel === "string" ? sp.rel : "";
  const toId = idSchema.safeParse(typeof sp.to === "string" ? sp.to : "");
  const relTarget = toId.success && ["child", "parent", "partner"].includes(relRaw) ? await loadMember(supabase, toId.data) : null;

  // Nhánh nào được tạo trực tiếp (chế độ chỉnh sửa mở hoặc là quản trị viên của nhánh)
  const scopes: (string | null)[] = [null, ...branches.map((b) => b.id)];
  const flags = await Promise.all(scopes.map((b) => canEditMembers(supabase, session.familyId, b)));
  const directBranches = scopes.filter((_, i) => flags[i]).map((b) => b ?? "");

  const initial = emptyValues({ branch_id: relTarget?.branch_id ?? "" });
  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Thêm thành viên</h1>
      {relTarget && (
        <p className="text-base text-ink-soft">
          Thêm {relRaw === "child" ? "con" : relRaw === "parent" ? "cha/mẹ" : "vợ/chồng"} của <strong>{relTarget.full_name}</strong>.
        </p>
      )}
      <MemberForm
        mode="create"
        initial={initial}
        branches={branches}
        access={{ birth: true, death: true, contact: true, photo: true }}
        directBranches={directBranches}
        isAdmin={ADMIN_ROLES.includes(session.role)}
        showVisibility
        rel={relTarget ? { rel: relRaw, relTo: relTarget.id, relToName: relTarget.full_name } : undefined}
        directAction={createMemberAction}
        requestAction={requestCreateMemberAction}
        cancelHref={relTarget ? `/thanh-vien/${relTarget.id}` : "/thanh-vien"}
      />
    </>
  );
}
