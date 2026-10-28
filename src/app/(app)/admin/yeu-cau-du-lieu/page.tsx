import { requireAdmin, can } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { DATA_REQUEST_LABELS, DATA_REQUEST_STATUS_LABELS } from "@/lib/data-requests";
import { Alert, Card, buttonClass, buttonGhostClass } from "@/components/ui";
import { handleRequest } from "./actions";

export const metadata = { title: "Yêu cầu về dữ liệu cá nhân" };

export default async function DataRequestsAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; all?: string }> }) {
  const session = await requireAdmin("/admin/yeu-cau-du-lieu");
  const { ok, error, all } = await searchParams;
  if (!(await can(session, "data_requests", "view"))) {
    return <Alert kind="error">Bạn không có quyền xem mục này.</Alert>;
  }
  const supabase = await createClient();
  let q = supabase.from("data_requests").select("id, user_id, kind, note, status, handler_note, created_at, handled_at").order("created_at", { ascending: false }).limit(100);
  if (!all) q = q.in("status", ["pending", "in_progress"]);
  const { data: rows } = await q;
  const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
  const { data: profiles } = ids.length ? await supabase.from("user_profiles").select("id, display_name").in("id", ids) : { data: [] };
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Yêu cầu về dữ liệu cá nhân</h1>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      <p className="text-base text-ink-soft">
        Thành viên có thể xin bản sao, sửa, hạn chế hoặc xóa dữ liệu của họ. Hệ thống chỉ ghi nhận và nhắc việc: bạn xử lý bằng tay (ví dụ sửa hồ sơ ở mục Thành viên) rồi đánh dấu kết quả.
        Với yêu cầu xóa, hãy xác minh trực tiếp với người gửi trước.
      </p>
      <p><a className={buttonGhostClass} href={all ? "/admin/yeu-cau-du-lieu" : "/admin/yeu-cau-du-lieu?all=1"}>{all ? "Chỉ xem việc đang chờ" : "Xem cả yêu cầu đã xong"}</a></p>
      {(rows ?? []).length === 0 && <Card><p className="text-base">Không có yêu cầu nào.</p></Card>}
      {(rows ?? []).map((r) => {
        const open = r.status === "pending" || r.status === "in_progress";
        return (
          <Card key={r.id} className="space-y-3">
            <p className="text-lg font-bold">{nameOf.get(r.user_id) ?? "(không rõ)"} — {DATA_REQUEST_LABELS[r.kind as keyof typeof DATA_REQUEST_LABELS]}</p>
            <p className="text-sm text-ink-soft">{DATA_REQUEST_STATUS_LABELS[r.status]} · gửi {formatDateTime(r.created_at, session.timezone)}</p>
            {r.note && <p className="text-base">Ghi chú: {r.note}</p>}
            {r.handler_note && <p className="text-base">Phản hồi đã gửi: {r.handler_note}</p>}
            {open && (
              <form action={handleRequest} className="space-y-3">
                <input type="hidden" name="id" value={r.id} />
                <label className="block text-base font-semibold">Phản hồi cho người gửi (tùy chọn)
                  <textarea name="note" rows={2} maxLength={1000} className="mt-1 block w-full rounded-xl border border-ink-soft/40 bg-white px-4 py-2 text-base text-ink" />
                </label>
                <div className="flex flex-wrap gap-3">
                  {r.status === "pending" && <button name="status" value="in_progress" className={buttonGhostClass}>Đang xử lý</button>}
                  <button name="status" value="done" className={buttonClass}>Đã xử lý xong</button>
                  <button name="status" value="rejected" className={buttonGhostClass}>Từ chối</button>
                </div>
              </form>
            )}
          </Card>
        );
      })}
    </>
  );
}
