import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ADMIN_ROLES, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buttonGhostClass } from "@/components/ui";
import { MemberForm } from "@/components/MemberForm";
import { loadBranches, loadFieldAccess, loadMember, UUID_RE } from "@/lib/members-data";
import { valuesFromRow } from "@/lib/members-form";
import { requestUpdateMemberAction, updateMemberAction } from "../../actions";

export const metadata = { title: "Sửa hồ sơ thành viên" };

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const session = await requireSession();
  // Khách không bao giờ thấy nút sửa; vào thẳng đường dẫn thì đưa về hồ sơ
  if (session.role === "guest") redirect(`/thanh-vien/${id}`);
  const supabase = await createClient();
  const [member, access, branches] = await Promise.all([loadMember(supabase, id), loadFieldAccess(supabase, id), loadBranches(supabase)]);
  if (!member) notFound();

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-3xl font-bold text-wine">Sửa hồ sơ: {member.full_name}</h1>
        <Link href={`/thanh-vien/${id}`} className={buttonGhostClass}>Về hồ sơ</Link>
      </div>
      <MemberForm
        mode="update"
        memberId={id}
        initial={valuesFromRow(member)}
        branches={branches}
        access={access}
        directAllowed={member.can_edit}
        isAdmin={ADMIN_ROLES.includes(session.role)}
        // Mức hiển thị chỉ có giá trị khi người xem được quyền sửa; khi chỉ gửi yêu cầu thì để quản trị viên đặt
        showVisibility={member.can_edit && member.birth_visibility !== null}
        directAction={updateMemberAction}
        requestAction={requestUpdateMemberAction}
        cancelHref={`/thanh-vien/${id}`}
      />
    </>
  );
}
