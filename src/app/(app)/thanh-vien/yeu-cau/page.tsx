import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { Alert, Card, buttonGhostClass } from "@/components/ui";
import { ConfirmButton } from "@/components/SubmitButton";
import { loadBranches, loadRequestContext } from "@/lib/members-data";
import { describeRequest, payloadChanges } from "@/lib/members-requests";
import { REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS } from "@/lib/members-text";
import type { ChangeRequestRow } from "@/lib/members-types";
import { cancelRequestAction } from "./actions";

export const metadata = { title: "Yêu cầu chỉnh sửa của tôi" };

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-champagne-soft text-ink",
  approved: "bg-green-50 text-ok border border-ok",
  rejected: "bg-red-50 text-danger border border-danger",
  cancelled: "bg-white text-ink-soft border border-ink-soft/40",
};

export default async function MyRequestsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireSession();
  if (session.role === "guest") redirect("/thanh-vien");
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  // Lọc tường minh theo người gửi (quản trị viên cũng đọc được yêu cầu của người khác qua RLS, nhưng trang này chỉ hiện của mình)
  const { data } = await supabase.from("member_change_requests").select("*")
    .eq("requested_by", session.userId).order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as ChangeRequestRow[];
  const branches = await loadBranches(supabase);
  const { ctx } = await loadRequestContext(supabase, rows, branches);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-3xl font-bold text-wine">Yêu cầu chỉnh sửa của tôi</h1>
        <Link href="/thanh-vien" className={buttonGhostClass}>Về danh sách thành viên</Link>
      </div>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      <p className="text-base text-ink-soft">
        Khi chế độ chỉnh sửa đang khóa, thay đổi của bạn được gửi đây để quản trị viên duyệt. Bạn có thể hủy yêu cầu khi còn đang chờ duyệt.
      </p>
      {rows.length === 0 ? (
        <Card><p className="text-base text-ink-soft">Bạn chưa gửi yêu cầu nào.</p></Card>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const changes = r.kind === "update_member" || r.kind === "create_member" ? payloadChanges(r, null, ctx) : [];
            return (
              <li key={r.id}>
                <Card className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-lg px-3 py-1 text-base font-semibold ${STATUS_STYLE[r.status]}`}>{REQUEST_STATUS_LABELS[r.status]}</span>
                    <span className="text-base font-semibold">{REQUEST_KIND_LABELS[r.kind]}</span>
                    <span className="ml-auto text-sm text-ink-soft">Gửi lúc {formatDateTime(r.created_at, session.timezone)}</span>
                  </div>
                  <p className="text-lg">{describeRequest(r, ctx)}</p>
                  {changes.length > 0 && (
                    <details>
                      <summary className="min-h-12 cursor-pointer py-3 text-base font-semibold text-wine">Xem nội dung đề xuất</summary>
                      <dl className="divide-y divide-champagne/40">
                        {changes.map((c) => (
                          <div key={c.key} className="grid gap-1 py-2 sm:grid-cols-3">
                            <dt className="text-base font-semibold text-ink-soft">{c.label}</dt>
                            <dd className="whitespace-pre-line text-base sm:col-span-2">{c.after}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                  {r.note && <p className="text-base text-ink-soft">Ghi chú của bạn: {r.note}</p>}
                  {r.review_note && <p className="rounded-xl bg-champagne-soft px-4 py-3 text-base">Quản trị viên ghi chú: {r.review_note}</p>}
                  {r.status === "pending" && (
                    <form action={cancelRequestAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmButton message="Hủy yêu cầu này?"
                        className="min-h-12 rounded-xl border border-danger px-5 text-base font-semibold text-danger hover:bg-red-50">Hủy yêu cầu</ConfirmButton>
                    </form>
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
