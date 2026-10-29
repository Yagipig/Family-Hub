import { requireAdmin, can } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { changedKeys } from "@/lib/data-requests";
import { Alert, Card, Field, buttonClass, buttonGhostClass } from "@/components/ui";

export const metadata = { title: "Nhật ký hoạt động" };
const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const session = await requireAdmin("/admin/nhat-ky");
  if (!(await can(session, "audit", "view"))) return <Alert kind="error">Bạn không có quyền xem nhật ký.</Alert>;
  const sp = await searchParams;
  // Chỉ nhận tiền tố hành động dạng chữ thường/số/chấm/gạch dưới (tránh ký tự đặc biệt của bộ lọc)
  const q = (sp.q ?? "").trim().toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 40);
  const page = Math.max(1, Math.min(Number.parseInt(sp.page ?? "1", 10) || 1, 10_000));
  const supabase = await createClient();
  let query = supabase.from("audit_logs").select("id, actor_id, action, entity_type, entity_id, before_data, after_data, created_at", { count: "exact" })
    .eq("family_id", session.familyId).order("id", { ascending: false });
  if (q) query = query.like("action", `${q}%`);
  const { data: rows, count } = await query.range((page - 1) * PAGE, page * PAGE - 1);
  const ids = [...new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: profiles } = ids.length ? await supabase.from("user_profiles").select("id, display_name").in("id", ids) : { data: [] };
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (p: number) => `/admin/nhat-ky?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Nhật ký hoạt động</h1>
      <p className="text-base text-ink-soft">Nhật ký chỉ thêm, không sửa hay xóa được. Trang này chỉ hiện tên các trường đã đổi, không hiện giá trị cũ/mới, để hạn chế lộ thông tin riêng tư.</p>
      <form className="flex flex-wrap items-end gap-3" action="/admin/nhat-ky">
        <div className="min-w-60 flex-1"><Field label="Lọc theo hành động (ví dụ member, payout, chat)" name="q" defaultValue={q} /></div>
        <button className={buttonClass}>Lọc</button>
      </form>
      <Card className="overflow-x-auto !p-0">
        <table className="w-full text-left text-base">
          <caption className="sr-only">Nhật ký hoạt động</caption>
          <thead className="bg-champagne-soft text-sm">
            <tr><th className="p-3">Thời gian</th><th className="p-3">Người thực hiện</th><th className="p-3">Hành động</th><th className="p-3">Đối tượng</th><th className="p-3">Trường đã đổi</th></tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-t border-champagne/50 align-top">
                <td className="p-3 whitespace-nowrap">{formatDateTime(r.created_at, session.timezone)}</td>
                <td className="p-3">{r.actor_id ? (nameOf.get(r.actor_id) ?? "(đã xóa)") : "Hệ thống"}</td>
                <td className="p-3 font-mono text-sm">{r.action}</td>
                <td className="p-3 text-sm">{r.entity_type}{r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}</td>
                <td className="p-3 text-sm">{changedKeys(r.before_data, r.after_data).join(", ") || "—"}</td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && <tr><td colSpan={5} className="p-4 text-ink-soft">Không có bản ghi nào.</td></tr>}
          </tbody>
        </table>
      </Card>
      <nav className="flex items-center justify-between" aria-label="Phân trang">
        {page > 1 ? <a className={buttonGhostClass} href={href(page - 1)}>← Trước</a> : <span />}
        <span className="text-base">Trang {page} / {pages}</span>
        {page < pages ? <a className={buttonGhostClass} href={href(page + 1)}>Sau →</a> : <span />}
      </nav>
    </>
  );
}
