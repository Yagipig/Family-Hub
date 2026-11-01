import Link from "next/link";
import { ADMIN_ROLES, can, requireSession } from "@/lib/auth";
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

  // “Thêm cha/mẹ/vợ/chồng/con/anh-chị-em” từ nút + trên cây: ?rel=child|parent|partner|sibling&to=<id>&g=male|female
  const relRaw = typeof sp.rel === "string" ? sp.rel : "";
  const toId = idSchema.safeParse(typeof sp.to === "string" ? sp.to : "");
  const relTarget = toId.success && ["child", "parent", "partner", "sibling"].includes(relRaw) ? await loadMember(supabase, toId.data) : null;
  const genderPreset = sp.g === "male" || sp.g === "female" ? sp.g : "";

  // Tạo hồ sơ cho người ĐÃ ĐĂNG KÝ tài khoản (?acct=<membershipId>): chỉ quản trị có quyền
  // gắn tài khoản; hồ sơ được điền sẵn tên tài khoản và sẽ tự gắn sau khi lưu.
  const acctId = idSchema.safeParse(typeof sp.acct === "string" ? sp.acct : "");
  let acct: { id: string; name: string } | null = null;
  if (acctId.success && (await can(session, "roles", "update"))) {
    const { data: ms } = await supabase.from("family_memberships")
      .select("id, user_id, member_id").eq("id", acctId.data).eq("status", "active").maybeSingle();
    const m = ms as { id: string; user_id: string; member_id: string | null } | null;
    if (m && !m.member_id) {
      const { data: prof } = await supabase.from("user_profiles").select("display_name").eq("id", m.user_id).maybeSingle();
      acct = { id: m.id, name: (prof as { display_name: string } | null)?.display_name ?? "" };
    }
  }

  // Nhánh nào được tạo trực tiếp (chế độ chỉnh sửa mở hoặc là quản trị viên của nhánh)
  const scopes: (string | null)[] = [null, ...branches.map((b) => b.id)];
  const flags = await Promise.all(scopes.map((b) => canEditMembers(supabase, session.familyId, b)));
  const directBranches = scopes.filter((_, i) => flags[i]).map((b) => b ?? "");

  const initial = emptyValues({
    branch_id: relTarget?.branch_id ?? "",
    ...(genderPreset ? { gender: genderPreset } : {}),
    ...(acct?.name ? { full_name: acct.name } : {}),
  });
  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Thêm thành viên</h1>
      {acct && (
        <p className="text-base text-ink-soft">
          Tạo hồ sơ cho tài khoản <strong>{acct.name || "(chưa đặt tên)"}</strong> — hồ sơ sẽ được gắn với tài khoản này ngay sau khi lưu.
        </p>
      )}
      {relTarget && (
        <p className="text-base text-ink-soft">
          Thêm {relRaw === "child" ? "con" : relRaw === "parent" ? "cha/mẹ" : relRaw === "sibling" ? "anh/chị/em (cùng cha mẹ)" : "vợ/chồng"} của <strong>{relTarget.full_name}</strong>.
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
        acct={acct ?? undefined}
        directAction={createMemberAction}
        requestAction={requestCreateMemberAction}
        cancelHref={relTarget ? `/thanh-vien/${relTarget.id}` : "/thanh-vien"}
      />
    </>
  );
}
