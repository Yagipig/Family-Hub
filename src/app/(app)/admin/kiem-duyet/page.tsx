import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { Alert, Card, buttonClass, buttonGhostClass } from "@/components/ui";
import { resolveReportAction, unhidePostAction } from "./actions";

export const metadata = { title: "Kiểm duyệt bảng tin" };

type Report = {
  report_id: string; post_id: string; comment_id: string | null; reason: string; reported_at: string; reporter_name: string;
  post_body: string; post_author_name: string; comment_body: string | null; post_hidden: boolean;
};
type Hidden = { id: string; body: string; author_name: string; hide_reason: string | null; hidden_at: string };

const clip = (s: string, n = 400) => (s.length > n ? `${s.slice(0, n)}…` : s);

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireAdmin("/admin/kiem-duyet");
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const [{ data: reportsRaw }, { data: hiddenRaw }] = await Promise.all([
    supabase.rpc("moderation_queue", { p_family: session.familyId }),
    supabase.rpc("hidden_posts", { p_family: session.familyId }),
  ]);
  const reports = (reportsRaw ?? []) as Report[];
  const hidden = (hiddenRaw ?? []) as Hidden[];

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Kiểm duyệt bảng tin</h1>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      <p className="text-base text-ink-soft">
        {session.role === "branch_admin" ? "Bạn chỉ thấy báo cáo thuộc nhánh của mình. " : ""}
        Mọi thao tác ẩn hoặc xóa đều được ghi vào nhật ký.
      </p>

      <section aria-labelledby="reports-h" className="space-y-4">
        <h2 id="reports-h" className="text-2xl font-bold">Báo cáo đang chờ ({reports.length})</h2>
        {reports.length === 0 && <Card><p className="text-lg">Không có báo cáo nào cần xử lý.</p></Card>}
        {reports.map((r) => (
          <Card key={r.report_id} className="space-y-3">
            <p className="text-base text-ink-soft">
              {r.reporter_name} báo cáo {r.comment_id ? "một bình luận" : "một bài viết"} · {formatDateTime(r.reported_at, session.timezone)}
            </p>
            <p className="text-lg"><strong>Lý do:</strong> {r.reason}</p>
            <blockquote className="whitespace-pre-wrap break-words rounded-xl bg-white p-4 text-base">
              {r.comment_id ? (r.comment_body ?? "(bình luận đã bị xóa)") : (r.post_body || "(bài chỉ có ảnh)")}
              <footer className="mt-2 text-sm text-ink-soft">
                {r.comment_id ? `Bình luận trong bài của ${r.post_author_name}` : `Người đăng: ${r.post_author_name}`}
                {r.post_hidden ? " · bài đang bị ẩn" : ""}
              </footer>
            </blockquote>
            {r.comment_id && <p className="text-sm text-ink-soft">Bài chứa bình luận: {clip(r.post_body, 160) || "(chỉ có ảnh)"}</p>}
            <form action={resolveReportAction} className="space-y-3">
              <input type="hidden" name="report" value={r.report_id} />
              <label className="block text-base font-semibold">Ghi chú xử lý (không bắt buộc)
                <input name="note" maxLength={500} className="mt-1 block min-h-12 w-full rounded-xl border border-ink-soft/40 bg-white px-4 text-base" />
              </label>
              <div className="flex flex-wrap gap-3">
                <button name="action" value="dismiss" className={buttonGhostClass}>Bỏ qua báo cáo</button>
                {!r.comment_id && !r.post_hidden && <button name="action" value="hide" className={buttonGhostClass}>Ẩn bài</button>}
                <button name="action" value="delete" className={buttonClass}>{r.comment_id ? "Xóa bình luận" : "Xóa bài"}</button>
              </div>
            </form>
          </Card>
        ))}
      </section>

      <section aria-labelledby="hidden-h" className="space-y-4">
        <h2 id="hidden-h" className="text-2xl font-bold">Bài đang bị ẩn ({hidden.length})</h2>
        {hidden.length === 0 && <Card><p className="text-lg">Không có bài nào đang bị ẩn.</p></Card>}
        {hidden.map((h) => (
          <Card key={h.id} className="space-y-3">
            <p className="text-base text-ink-soft">{h.author_name} · ẩn lúc {formatDateTime(h.hidden_at, session.timezone)}</p>
            <p className="whitespace-pre-wrap break-words text-base">{clip(h.body) || "(bài chỉ có ảnh)"}</p>
            {h.hide_reason && <p className="text-base"><strong>Lý do ẩn:</strong> {h.hide_reason}</p>}
            <form action={unhidePostAction}>
              <input type="hidden" name="post" value={h.id} />
              <button className={buttonGhostClass}>Hiện lại bài</button>
            </form>
          </Card>
        ))}
      </section>
    </>
  );
}
