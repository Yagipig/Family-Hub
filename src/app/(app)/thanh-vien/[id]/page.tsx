import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, Field, buttonClass, buttonGhostClass } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { ConfirmButton } from "@/components/SubmitButton";
import { buildIndex, siblingsOf } from "@/lib/family-graph";
import { canEditMembers, fetchAll, loadBranches, loadFieldAccess, loadMember, loadPickerMembers, toTreePerson, UUID_RE } from "@/lib/members-data";
import { signAvatarPaths } from "@/lib/members-media";
import {
  ageText, BIRTHDAY_MODE_LABELS, formatLunar, formatSolar, GENDER_LABELS, VISIBILITY_LABELS,
} from "@/lib/members-text";
import type { MemberRow, ParentLinkRow, PartnershipRow, TreeLink, TreePerson } from "@/lib/members-types";
import { deleteMemberAction, requestDeleteMemberAction } from "../actions";
import { Relations, type RelMode } from "./Relations";

export const metadata = { title: "Hồ sơ thành viên" };

const NOT_PUBLIC = "Không công khai";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-3">
      <dt className="text-base font-semibold text-ink-soft">{label}</dt>
      <dd className="text-base sm:col-span-2">{children}</dd>
    </div>
  );
}
const Hidden = () => <span className="rounded-md bg-champagne-soft px-2 py-0.5 text-sm text-ink-soft">{NOT_PUBLIC}</span>;

function birthLines(m: MemberRow) {
  const solar = formatSolar(m.birth_solar_year, m.birth_solar_month, m.birth_solar_day);
  const lunar = formatLunar(m.birth_lunar_year, m.birth_lunar_month, m.birth_lunar_day, m.birth_lunar_leap);
  return { solar, lunar };
}

export default async function MemberProfilePage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const session = await requireSession();
  const { ok, error } = await searchParams;
  const supabase = await createClient();

  const member = await loadMember(supabase, id);
  if (!member) notFound();

  const isGuest = session.role === "guest";
  const [access, branches, canRel, canDelete] = await Promise.all([
    loadFieldAccess(supabase, id),
    loadBranches(supabase),
    isGuest ? Promise.resolve(false) : canEditMembers(supabase, session.familyId, member.branch_id),
    isGuest ? Promise.resolve(false) : can(session, "members", "delete", member.branch_id),
  ]);

  // ----- Quan hệ -----
  const [parentRes, childRes, partnerRes] = await Promise.all([
    supabase.from("member_parent_links_v").select("id, child_id, parent_id, kind").eq("child_id", id),
    supabase.from("member_parent_links_v").select("id, child_id, parent_id, kind").eq("parent_id", id),
    supabase.from("member_partnerships_v").select("id, member_a, member_b, status, start_year, end_year").or(`member_a.eq.${id},member_b.eq.${id}`),
  ]);
  const parentLinks = (parentRes.data ?? []) as ParentLinkRow[];
  const childLinks = (childRes.data ?? []) as ParentLinkRow[];
  const partnerships = (partnerRes.data ?? []) as PartnershipRow[];
  const parentIds = parentLinks.map((l) => l.parent_id);
  const siblingLinks = parentIds.length
    ? ((await supabase.from("member_parent_links_v").select("id, child_id, parent_id, kind").in("parent_id", parentIds)).data ?? []) as ParentLinkRow[]
    : [];
  const siblingIds = [...new Set(siblingLinks.map((l) => l.child_id).filter((c) => c !== id))];
  // Cha mẹ của anh chị em (để phân biệt “cùng cha mẹ” và “cùng cha/mẹ”)
  const sibParentLinks = siblingIds.length
    ? ((await supabase.from("member_parent_links_v").select("id, child_id, parent_id, kind").in("child_id", siblingIds)).data ?? []) as ParentLinkRow[]
    : [];

  const partnerIds = partnerships.map((p) => (p.member_a === id ? p.member_b : p.member_a));
  const nameIds = [...new Set([...parentIds, ...childLinks.map((l) => l.child_id), ...partnerIds, ...siblingIds])];
  const people = new Map<string, TreePerson>();
  if (nameIds.length) {
    const rows = await fetchAll<Parameters<typeof toTreePerson>[0]>((a, b) => supabase.from("members_view")
      .select("id, full_name, nickname, gender, avatar_path, branch_id, birth_solar_year, is_deceased, death_solar_year, generation_no")
      .in("id", nameIds).order("id").range(a, b));
    const urls = await signAvatarPaths(rows.map((r) => r.avatar_path));
    for (const r of rows) people.set(r.id, { ...toTreePerson(r), avatar: r.avatar_path ? (urls[r.avatar_path] ?? null) : null });
  }
  const self = { ...toTreePerson({ ...member }), avatar: null };
  const stub = (pid: string): TreePerson => people.get(pid) ?? { id: pid, name: "(không xem được)", nick: null, gender: null, branchId: null, by: null, dy: null, dead: false, avatar: null, gen: null };
  const known = (pid: string) => people.has(pid);

  const allLinks: TreeLink[] = [...parentLinks, ...childLinks, ...siblingLinks, ...sibParentLinks]
    .map((l) => ({ id: l.id, child: l.child_id, parent: l.parent_id, kind: l.kind }));
  const ixPeople = new Map<string, TreePerson>([[id, self]]);
  for (const l of allLinks) for (const x of [l.child, l.parent]) if (!ixPeople.has(x)) ixPeople.set(x, stub(x));
  for (const [k, v] of people) ixPeople.set(k, v);
  const siblings = siblingsOf(buildIndex([...ixPeople.values()], allLinks, []), id).filter((s) => known(s.id));

  const relMode: RelMode = isGuest ? "none" : canRel ? "direct" : "request";
  const pickers = relMode === "none" ? [] : await loadPickerMembers(supabase, branches);
  const branchName = member.branch_id ? branches.find((b) => b.id === member.branch_id)?.name : null;
  const birth = birthLines(member);
  const deathSolar = formatSolar(member.death_solar_year, member.death_solar_month, member.death_solar_day);
  const deathLunar = formatLunar(null, member.death_lunar_month, member.death_lunar_day, member.death_lunar_leap);
  const age = ageText(member.birth_solar_year, access.death ? member.death_solar_year : null, member.is_deceased);

  return (
    <>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar name={member.full_name} src={access.photo && member.avatar_path ? ((await signAvatarPaths([member.avatar_path]))[member.avatar_path] ?? null) : null} gender={member.gender} size={112} />
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-3xl font-bold leading-tight text-wine">{member.full_name}</h1>
          {member.nickname && <p className="text-lg text-ink-soft">Thường gọi: {member.nickname}</p>}
          <p className="flex flex-wrap gap-2 text-base">
            {member.gender && <span className="rounded-lg bg-champagne-soft px-3 py-1">{GENDER_LABELS[member.gender]}</span>}
            {member.is_deceased && <span className="rounded-lg bg-champagne-soft px-3 py-1">Đã mất</span>}
            {age && <span className="rounded-lg bg-champagne-soft px-3 py-1">{age}</span>}
            {member.generation_no != null && <span className="rounded-lg bg-champagne-soft px-3 py-1">Đời {member.generation_no}</span>}
            {branchName && <span className="rounded-lg bg-champagne-soft px-3 py-1">Nhánh {branchName}</span>}
            {member.is_self && <span className="rounded-lg bg-wine px-3 py-1 text-white">Đây là hồ sơ của bạn</span>}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {!isGuest && (
              <Link href={`/thanh-vien/${id}/sua`} className={buttonClass}>
                {member.can_edit ? "Sửa hồ sơ" : "Đề nghị chỉnh sửa"}
              </Link>
            )}
            <Link href={`/gia-pha?focus=${id}`} className={buttonGhostClass}>Xem trên cây gia phả</Link>
            <Link href="/thanh-vien" className={buttonGhostClass}>Danh sách</Link>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-bold text-wine">Thông tin</h2>
        <dl className="mt-2 divide-y divide-champagne/40">
          <Row label="Ngày sinh">
            {birth.solar || birth.lunar ? (
              <>
                {birth.solar && <span className="block">Dương lịch: {birth.solar}</span>}
                {access.birth && birth.lunar && <span className="block">Âm lịch: {birth.lunar}</span>}
                {access.birth && <span className="block text-sm text-ink-soft">Nhắc sinh nhật theo: {BIRTHDAY_MODE_LABELS[member.birthday_mode]}</span>}
                {!access.birth && <span className="mt-1 block">Ngày và tháng: <Hidden /></span>}
              </>
            ) : access.birth ? <span className="text-ink-soft">Chưa có thông tin</span> : <Hidden />}
          </Row>
          {member.is_deceased && (
            <Row label="Ngày mất">
              {!access.death ? <Hidden /> : deathSolar || deathLunar ? (
                <>
                  {deathSolar && <span className="block">Dương lịch: {deathSolar}</span>}
                  {deathLunar && <span className="block">Âm lịch (ngày giỗ): {deathLunar}</span>}
                </>
              ) : <span className="text-ink-soft">Chưa có thông tin</span>}
            </Row>
          )}
          <Row label="Quê quán">{member.hometown ?? <span className="text-ink-soft">Chưa có thông tin</span>}</Row>
          {member.generation_title && <Row label="Tên đời / bối">{member.generation_title}</Row>}
          <Row label="Điện thoại">{!access.contact ? <Hidden /> : member.phone ?? <span className="text-ink-soft">Chưa có</span>}</Row>
          <Row label="Email">{!access.contact ? <Hidden /> : member.email ?? <span className="text-ink-soft">Chưa có</span>}</Row>
          {member.birth_visibility && (
            <Row label="Ai được xem">
              <span className="block text-sm">Ngày sinh: {VISIBILITY_LABELS[member.birth_visibility]}</span>
              {member.death_visibility && <span className="block text-sm">Ngày mất: {VISIBILITY_LABELS[member.death_visibility]}</span>}
              {member.contact_visibility && <span className="block text-sm">Liên hệ: {VISIBILITY_LABELS[member.contact_visibility]}</span>}
              {member.photo_visibility && <span className="block text-sm">Ảnh: {VISIBILITY_LABELS[member.photo_visibility]}</span>}
            </Row>
          )}
        </dl>
        {member.bio && (
          <div className="mt-4 border-t border-champagne/40 pt-4">
            <h3 className="text-lg font-bold">Tiểu sử</h3>
            <p className="mt-2 whitespace-pre-line text-base leading-relaxed">{member.bio}</p>
          </div>
        )}
      </Card>

      <Relations
        memberId={id}
        mode={relMode}
        parents={parentLinks.filter((l) => known(l.parent_id)).map((l) => ({ linkId: l.id, person: stub(l.parent_id), kind: l.kind }))}
        children={childLinks.filter((l) => known(l.child_id)).map((l) => ({ linkId: l.id, person: stub(l.child_id), kind: l.kind }))}
        partners={partnerships.map((p) => ({ id: p.id, person: stub(p.member_a === id ? p.member_b : p.member_a), status: p.status, start: p.start_year, end: p.end_year }))}
        siblings={siblings.map((s) => ({ person: stub(s.id), full: s.full }))}
        pickers={pickers}
      />

      {!isGuest && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold text-danger">Xóa hồ sơ</h2>
          {canDelete ? (
            <form action={deleteMemberAction} className="space-y-3">
              <input type="hidden" name="memberId" value={id} />
              <p className="text-base text-ink-soft">Hồ sơ được chuyển vào Thùng rác, có thể khôi phục. Hồ sơ đang gắn với một tài khoản thì chưa xóa được.</p>
              <ConfirmButton className="min-h-12 rounded-xl border border-danger px-6 text-base font-semibold text-danger hover:bg-red-50"
                message={`Chuyển hồ sơ “${member.full_name}” vào thùng rác?`}>Xóa hồ sơ này</ConfirmButton>
            </form>
          ) : (
            <details>
              <summary className="min-h-12 cursor-pointer py-3 text-base font-semibold text-danger">Đề nghị xóa hồ sơ này</summary>
              <form action={requestDeleteMemberAction} className="space-y-3 pb-2">
                <input type="hidden" name="memberId" value={id} />
                <Field label="Lý do (không bắt buộc)" name="note" maxLength={1000} autoComplete="off" />
                <ConfirmButton className="min-h-12 rounded-xl border border-danger px-6 text-base font-semibold text-danger hover:bg-red-50"
                  message="Gửi yêu cầu xóa hồ sơ này cho quản trị viên?">Gửi yêu cầu xóa</ConfirmButton>
              </form>
            </details>
          )}
        </Card>
      )}
    </>
  );
}
