import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { Alert, Card, Field, buttonGhostClass } from "@/components/ui";
import { ReviewButtons } from "@/components/ReviewButtons";
import { loadBranches, loadRequestContext } from "@/lib/members-data";
import { describeRequest, payloadChanges } from "@/lib/members-requests";
import { REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS } from "@/lib/members-text";
import type { ChangeRequestRow } from "@/lib/members-types";
import { reviewRequestAction } from "./actions";

export const metadata = { title: "Duyệt yêu cầu chỉnh sửa" };

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; status?: string }> }) {
  const session = await requireAdmin("/admin/yeu-cau");
  const { ok, error, status } = await searchParams;
  const showAll = status === "all";
  const supabase = await createClient();

  // RLS: quản trị nhánh chỉ thấy yêu cầu thuộc nhánh của mình; quản trị gia đình thấy tất cả
  let query = supabase.from("member_change_requests").select("*");
  if (!showAll) query = query.eq("status", "pending");
  const { data } = await query.order("created_at", { ascending: !showAll }).limit(100);
  const rows = (data ?? []) as ChangeRequestRow[];

  const branches = await loadBranches(supabase);
  const { ctx, current } = await loadRequestContext(supabase, rows, branches, true);
  const userIds = [...new Set(rows.map((r) => r.requested_by))];
  const { data: profiles } = userIds.length
    ? await supabase.from("user_profiles").select("id, display_name").in("id", userIds)
    : { data: [] };
  const who = new Map(((profiles ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-3xl font-bold text-wine">Duyệt yêu cầu chỉnh sửa</h1>
        <Link href={showAll ? "/admin/yeu-cau" : "/admin/yeu-cau?status=all"} className={buttonGhostClass}>
          {showAll ? "Chỉ xem yêu cầu đang chờ" : "Xem cả yêu cầu đã xử lý"}
        </Link>
      </div>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      <p className="text-base text-ink-soft">
        {session.role === "branch_admin" ? "Bạn chỉ thấy các yêu cầu thuộc nhánh của mình. " : ""}
        Xem kỹ phần so sánh “Hiện tại” và “Đề xuất” trước khi duyệt. Duyệt sẽ áp dụng thay đổi ngay; mọi duyệt/từ chối đều được ghi nhật ký.
      </p>

      {rows.length === 0 ? (
        <Card><p className="text-base text-ink-soft">{showAll ? "Chưa có yêu cầu nào." : "Không có yêu cầu nào đang chờ duyệt."}</p></Card>
      ) : (
        <ul className="space-y-5">
          {rows.map((r) => {
            const target = r.target_member_id ? current.get(r.target_member_id) ?? null : null;
            const changes = r.kind === "update_member" || r.kind === "create_member"
              ? payloadChanges(r, target as unknown as Record<string, unknown> | null, ctx) : [];
            const branch = r.branch_id ? ctx.branches.get(r.branch_id) : null;
            return (
              <li key={r.id}>
                <Card className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-lg bg-champagne-soft px-3 py-1 text-base font-semibold">{REQUEST_KIND_LABELS[r.kind]}</span>
                    {r.status !== "pending" && <span className="rounded-lg border border-ink-soft/40 px-3 py-1 text-base">{REQUEST_STATUS_LABELS[r.status]}</span>}
                    <span className="ml-auto text-sm text-ink-soft">
                      {who.get(r.requested_by) ?? "(không rõ)"} · {formatDateTime(r.created_at, session.timezone)}{branch ? ` · Nhánh ${branch}` : ""}
                    </span>
                  </div>
                  <p className="text-lg font-semibold">{describeRequest(r, ctx)}</p>

                  {changes.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-champagne/60">
                      <table className="w-full min-w-[32rem] text-left text-base">
                        <thead className="bg-champagne-soft">
                          <tr>
                            <th scope="col" className="px-4 py-3">Mục</th>
                            {r.kind === "update_member" && <th scope="col" className="px-4 py-3">Hiện tại</th>}
                            <th scope="col" className="px-4 py-3">Đề xuất</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-champagne/40">
                          {changes.map((c) => (
                            <tr key={c.key} className={c.known ? "" : "bg-red-50"}>
                              <th scope="row" className="px-4 py-3 align-top font-semibold">
                                {c.label}
                                {!c.known && <span className="block text-sm font-normal text-danger">Trường không có trong biểu mẫu — hãy kiểm tra kỹ</span>}
                              </th>
                              {r.kind === "update_member" && <td className="whitespace-pre-line px-4 py-3 align-top text-ink-soft line-through decoration-ink-soft/50">{c.before}</td>}
                              <td className="whitespace-pre-line px-4 py-3 align-top font-semibold text-wine">{c.after}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {r.kind === "update_member" && !target && <p className="text-sm text-ink-soft">Không đọc được hồ sơ hiện tại (có thể đã bị xóa) nên không có cột “Hiện tại”.</p>}
                  {r.kind === "add_partner" && (
                    <p className="text-sm text-ink-soft">
                      {[r.payload.start_year ? `Từ năm ${String(r.payload.start_year)}` : null, r.payload.end_year ? `đến năm ${String(r.payload.end_year)}` : null].filter(Boolean).join(" ")}
                    </p>
                  )}
                  {r.note && <p className="rounded-xl bg-champagne-soft px-4 py-3 text-base">Ghi chú của người gửi: {r.note}</p>}

                  {r.status === "pending" ? (
                    <form action={reviewRequestAction} className="space-y-3">
                      <input type="hidden" name="id" value={r.id} />
                      <Field label="Ghi chú gửi lại cho người gửi (không bắt buộc)" name="note" maxLength={1000} autoComplete="off" />
                      <ReviewButtons />
                    </form>
                  ) : (
                    <p className="text-sm text-ink-soft">
                      {r.reviewed_at ? `Xử lý lúc ${formatDateTime(r.reviewed_at, session.timezone)}` : ""}{r.review_note ? ` · Ghi chú: ${r.review_note}` : ""}
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
