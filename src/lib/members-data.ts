import "server-only";
import { createClient } from "@/lib/supabase/server";
import { attachAvatarUrls } from "./members-media";
import { referencedIds, type RequestContext } from "./members-requests";
import type {
  BranchRow, ChangeRequestRow, FieldAccess, MemberRow, ParentLinkRow, PartnershipRow, PickerMember, TreeLink, TreePartner, TreePerson,
} from "./members-types";

export type Supa = Awaited<ReturnType<typeof createClient>>;

const PAGE = 1000; // giới hạn mặc định của PostgREST (Supabase) là 1000 dòng mỗi lần

/** Đọc hết mọi trang (view có thể có hơn 1000 dòng). Phải có thứ tự ổn định trong `run`. */
export async function fetchAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw new Error("Không đọc được dữ liệu");
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    if (from > 50_000) break; // chặn vòng lặp bất thường
  }
  return out;
}

export async function loadBranches(supabase: Supa): Promise<BranchRow[]> {
  const { data } = await supabase.from("branches").select("id, name, parent_branch_id").order("name");
  return (data ?? []) as BranchRow[];
}

type TreeMemberRow = {
  id: string; full_name: string; nickname: string | null; gender: TreePerson["gender"]; avatar_path: string | null;
  branch_id: string | null; birth_solar_year: number | null; is_deceased: boolean; death_solar_year: number | null; generation_no: number | null;
};

export function toTreePerson(r: TreeMemberRow): TreePerson {
  return {
    id: r.id, name: r.full_name, nick: r.nickname, gender: r.gender, branchId: r.branch_id, by: r.birth_solar_year,
    dy: r.death_solar_year, dead: r.is_deceased, avatar: r.avatar_path, gen: r.generation_no,
  };
}

export async function loadTreeData(supabase: Supa): Promise<{ people: TreePerson[]; links: TreeLink[]; partners: TreePartner[] }> {
  const [members, links, partners] = await Promise.all([
    fetchAll<TreeMemberRow>((a, b) => supabase.from("members_view")
      .select("id, full_name, nickname, gender, avatar_path, branch_id, birth_solar_year, is_deceased, death_solar_year, generation_no")
      .order("id").range(a, b)),
    fetchAll<ParentLinkRow>((a, b) => supabase.from("member_parent_links_v").select("id, child_id, parent_id, kind").order("id").range(a, b)),
    fetchAll<PartnershipRow>((a, b) => supabase.from("member_partnerships_v")
      .select("id, member_a, member_b, status, start_year, end_year").order("id").range(a, b)),
  ]);
  return {
    people: await attachAvatarUrls(members.map(toTreePerson)),
    links: links.map((l) => ({ id: l.id, child: l.child_id, parent: l.parent_id, kind: l.kind })),
    partners: partners.map((p) => ({ id: p.id, a: p.member_a, b: p.member_b, status: p.status, start: p.start_year, end: p.end_year })),
  };
}

/** Danh sách rút gọn cho ô chọn thành viên. */
export async function loadPickerMembers(supabase: Supa, branches: BranchRow[]): Promise<PickerMember[]> {
  const nameOf = new Map(branches.map((b) => [b.id, b.name]));
  const rows = await fetchAll<{ id: string; full_name: string; nickname: string | null; alt_names: string | null; birth_solar_year: number | null; branch_id: string | null }>(
    (a, b) => supabase.from("members_view").select("id, full_name, nickname, alt_names, birth_solar_year, branch_id").order("id").range(a, b));
  return rows
    .map((r) => ({ id: r.id, name: r.full_name, nick: r.nickname, alt: r.alt_names, by: r.birth_solar_year, branch: r.branch_id ? (nameOf.get(r.branch_id) ?? null) : null }))
    .sort((x, y) => x.name.localeCompare(y.name, "vi"));
}

export async function loadMember(supabase: Supa, id: string): Promise<MemberRow | null> {
  const { data } = await supabase.from("members_view").select("*").eq("id", id).maybeSingle();
  return (data as MemberRow | null) ?? null;
}

export async function loadFieldAccess(supabase: Supa, id: string): Promise<FieldAccess> {
  const { data, error } = await supabase.rpc("member_field_access", { p_member: id });
  const d = data as Partial<FieldAccess> | null;
  // Không xác định được => coi như BỊ CHE (an toàn: không cho sửa/ghi đè trường có thể đang ẩn)
  if (error || !d) return { birth: false, death: false, contact: false, photo: false };
  return { birth: !!d.birth, death: !!d.death, contact: !!d.contact, photo: !!d.photo };
}

export async function canEditMembers(supabase: Supa, familyId: string, branchId: string | null): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_edit_members", { p_family: familyId, p_branch: branchId });
  return !error && data === true;
}

/** Mã định danh hợp lệ để dùng trong URL/truy vấn. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- Yêu cầu chỉnh sửa ----------
async function selectIn<T>(supabase: Supa, table: string, columns: string, column: string, ids: string[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const { data } = await supabase.from(table).select(columns).in(column, chunk);
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

/** Tra tên hồ sơ, quan hệ, nhánh cho một lô yêu cầu (chỉ những gì người xem được theo RLS/view). */
export async function loadRequestContext(
  supabase: Supa, rows: ChangeRequestRow[], branches: BranchRow[], withCurrent = false,
): Promise<{ ctx: RequestContext; current: Map<string, MemberRow> }> {
  const ids = referencedIds(rows);
  const [links, partnerships] = await Promise.all([
    selectIn<ParentLinkRow>(supabase, "member_parent_links_v", "id, child_id, parent_id, kind", "id", [...ids.links]),
    selectIn<PartnershipRow>(supabase, "member_partnerships_v", "id, member_a, member_b, status, start_year, end_year", "id", [...ids.partnerships]),
  ]);
  const memberIds = new Set(ids.members);
  for (const l of links) { memberIds.add(l.child_id); memberIds.add(l.parent_id); }
  for (const p of partnerships) { memberIds.add(p.member_a); memberIds.add(p.member_b); }
  const members = await selectIn<MemberRow>(supabase, "members_view", withCurrent ? "*" : "id, full_name", "id", [...memberIds]);
  const current = new Map<string, MemberRow>();
  if (withCurrent) for (const m of members) current.set(m.id, m);
  return {
    ctx: {
      members: new Map(members.map((m) => [m.id, m.full_name])),
      links: new Map(links.map((l) => [l.id, { child: l.child_id, parent: l.parent_id, kind: l.kind }])),
      partnerships: new Map(partnerships.map((p) => [p.id, { a: p.member_a, b: p.member_b, status: p.status }])),
      branches: new Map(branches.map((b) => [b.id, b.name])),
    },
    current,
  };
}
