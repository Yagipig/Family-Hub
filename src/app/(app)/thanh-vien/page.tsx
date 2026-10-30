import Link from "next/link";
import { redirect } from "next/navigation";
import { can, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, buttonClass, buttonGhostClass, Card, SelectField } from "@/components/ui";
import { MemberCard, type MemberCardData } from "@/components/MemberCard";
import { branchWithDescendants } from "@/lib/family-graph";
import { loadBranches } from "@/lib/members-data";
import { signAvatarPaths } from "@/lib/members-media";
import { parseListParams } from "@/lib/members-schemas";
import { accentInsensitivePattern } from "@/lib/members-text";

export const metadata = { title: "Thành viên" };

const PAGE_SIZE = 24;

export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const params = parseListParams(sp);
  const ok = typeof sp.ok === "string" ? sp.ok : undefined;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const supabase = await createClient();
  const branches = await loadBranches(supabase);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));

  let query = supabase.from("members_view")
    .select("id, full_name, nickname, alt_names, gender, avatar_path, branch_id, birth_solar_year, death_solar_year, is_deceased, hometown, generation_no", { count: "exact" });
  const re = accentInsensitivePattern(params.q);
  // Mẫu đã được làm sạch (chỉ chữ, số, khoảng trắng, gạch ngang và lớp ký tự) nên đặt trong dấu nháy là an toàn
  if (re) query = query.or(`full_name.imatch."${re}",nickname.imatch."${re}",alt_names.imatch."${re}",hometown.imatch."${re}"`);
  if (params.branch === "none") query = query.is("branch_id", null);
  else if (params.branch) query = query.in("branch_id", [...branchWithDescendants(branches, params.branch)]);
  if (params.gender) query = query.eq("gender", params.gender);
  if (params.alive) query = query.eq("is_deceased", params.alive === "deceased");
  const from = (params.page - 1) * PAGE_SIZE;
  const { data, count, error: qError } = await query.order("full_name").order("id").range(from, from + PAGE_SIZE - 1);

  // Trang vượt quá số dòng (PostgREST trả PGRST103): quay về trang đầu thay vì báo lỗi
  if (qError?.code === "PGRST103" && params.page > 1) {
    const u = new URLSearchParams();
    for (const k of ["q", "branch", "gender", "alive"] as const) if (params[k]) u.set(k, params[k]);
    redirect(`/thanh-vien${u.toString() ? `?${u}` : ""}`);
  }
  const rows = (data ?? []) as {
    id: string; full_name: string; nickname: string | null; alt_names: string | null; gender: MemberCardData["gender"]; avatar_path: string | null;
    branch_id: string | null; birth_solar_year: number | null; death_solar_year: number | null; is_deceased: boolean;
    hometown: string | null; generation_no: number | null;
  }[];
  const avatarUrls = await signAvatarPaths(rows.map((r) => r.avatar_path));
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isGuest = session.role === "guest";
  const canTrash = !isGuest && (await can(session, "members", "delete"));

  const link = (page: number) => {
    const u = new URLSearchParams();
    if (params.q) u.set("q", params.q);
    if (params.branch) u.set("branch", params.branch);
    if (params.gender) u.set("gender", params.gender);
    if (params.alive) u.set("alive", params.alive);
    if (page > 1) u.set("page", String(page));
    const s = u.toString();
    return `/thanh-vien${s ? `?${s}` : ""}`;
  };

  return (
    <>
	      <div className="flex flex-wrap items-center gap-2">
	        <h1 className="mr-auto text-2xl font-bold tracking-tight text-wine md:text-3xl">Thành viên</h1>
	        <Link href="/gia-pha" className={buttonGhostClass + " text-sm"}>Xem cây</Link>
	        {!isGuest && <Link href="/thanh-vien/yeu-cau" className={buttonGhostClass + " text-sm"}>Yêu cầu</Link>}
	        {canTrash && <Link href="/thanh-vien/thung-rac" className={buttonGhostClass + " text-sm"}>Thùng rác</Link>}
	        {!isGuest && <Link href="/thanh-vien/moi" className={buttonClass + " text-sm"}>Thêm</Link>}
	      </div>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {qError && <Alert kind="error">Không tải được danh sách. Vui lòng thử lại.</Alert>}

      <Card>
        <form method="get" action="/thanh-vien" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Tìm thành viên">
          <label className="block text-base font-semibold sm:col-span-2 lg:col-span-4">
            Tìm theo tên, tên thường gọi hoặc quê quán
	            <input type="search" name="q" defaultValue={params.q} maxLength={40} autoComplete="off"
	              placeholder="Gõ không dấu, ví dụ: nguyen van an"
	              className="mt-1 block min-h-11 w-full rounded-xl border border-ink-soft/40 bg-white px-4 py-2 text-[15px] text-ink" />
          </label>
          <SelectField label="Nhánh họ" name="branch" defaultValue={params.branch}>
            <option value="">Tất cả các nhánh</option>
            <option value="none">Chưa xếp nhánh</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </SelectField>
          <SelectField label="Giới tính" name="gender" defaultValue={params.gender}>
            <option value="">Tất cả</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option>
          </SelectField>
          <SelectField label="Tình trạng" name="alive" defaultValue={params.alive}>
            <option value="">Còn sống và đã mất</option><option value="alive">Còn sống</option><option value="deceased">Đã mất</option>
          </SelectField>
          <div className="flex items-end gap-3">
            <button className={buttonClass}>Tìm</button>
            <Link href="/thanh-vien" className={buttonGhostClass}>Xóa lọc</Link>
          </div>
        </form>
      </Card>

      <p className="text-base text-ink-soft" aria-live="polite">
        {total === 0 ? "Không có thành viên phù hợp." : `Có ${total} thành viên${params.branch && params.branch !== "none" ? " (gồm cả các nhánh con)" : ""}. Trang ${Math.min(params.page, pages)} / ${pages}.`}
      </p>

      <ul className="grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.id}>
            <MemberCard m={{
              id: r.id, full_name: r.full_name, nickname: r.nickname, alt_names: r.alt_names, gender: r.gender, avatar: r.avatar_path ? (avatarUrls[r.avatar_path] ?? null) : null,
              birth_solar_year: r.birth_solar_year, death_solar_year: r.death_solar_year, is_deceased: r.is_deceased,
              hometown: r.hometown, branchName: r.branch_id ? (branchName.get(r.branch_id) ?? null) : null, generation_no: r.generation_no,
            }} />
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center justify-between gap-3">
          {params.page > 1 ? <Link href={link(params.page - 1)} className={buttonGhostClass} rel="prev">← Trang trước</Link> : <span />}
          <span className="text-base text-ink-soft">Trang {params.page} / {pages}</span>
          {params.page < pages ? <Link href={link(params.page + 1)} className={buttonGhostClass} rel="next">Trang sau →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
