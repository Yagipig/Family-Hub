import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadUserTimezone } from "@/lib/chat-server";
import { ACTION_LABELS, REASONS, type ReportReport } from "@/lib/chat";
import { formatDateTime } from "@/lib/format";
import { Alert, Card, buttonClass, buttonGhostClass } from "@/components/ui";
import { ChatConfirmButton } from "@/components/ChatConfirmButton";
import { resolveReport } from "./actions";

export const metadata = { title: "Báo cáo tin nhắn" };

const dangerBtn =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-danger px-5 py-2 text-base font-semibold text-danger hover:bg-red-50";

export default async function ReportsPage({
  searchParams,
}: { searchParams: Promise<{ ok?: string; error?: string; trang?: string }> }) {
  const session = await requireAdmin("/admin/bao-cao");
  const { ok, error, trang } = await searchParams;
  const status = trang === "da-xu-ly" ? "resolved" : "open";
  const supabase = await createClient();
  const tz = await loadUserTimezone(supabase, session.userId);

  // View chỉ trả báo cáo trong phạm vi quyền của người xem (quản trị nhánh: chỉ nhóm nhánh của mình)
  const { data } = await supabase
    .from("chat_reports_v")
    .select("*")
    .eq("can_resolve", true)
    .eq("status", status)
    .order("created_at", { ascending: status === "open" })
    .limit(100);
  const reports = (data ?? []) as ReportReport[];

  const tab = (active: boolean) =>
    `inline-flex min-h-12 items-center rounded-xl px-5 py-2 text-base font-semibold ${active ? "bg-wine text-white" : "border border-wine text-wine hover:bg-champagne-soft"}`;

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Báo cáo tin nhắn</h1>
      <p className="text-base text-ink-soft">
        Bạn chỉ thấy nội dung của tin bị báo cáo (bản chụp lúc báo cáo), không đọc được cả cuộc trò chuyện. Mọi thao tác xử lý đều được ghi vào nhật ký.
      </p>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <nav aria-label="Lọc báo cáo" className="flex flex-wrap gap-2">
        <Link href="/admin/bao-cao" className={tab(status === "open")} aria-current={status === "open" ? "page" : undefined}>Chờ xử lý</Link>
        <Link href="/admin/bao-cao?trang=da-xu-ly" className={tab(status === "resolved")} aria-current={status === "resolved" ? "page" : undefined}>Đã xử lý</Link>
      </nav>

      {reports.length === 0 ? (
        <Card><p className="text-lg text-ink-soft">{status === "open" ? "Không có báo cáo nào đang chờ xử lý." : "Chưa có báo cáo nào được xử lý."}</p></Card>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => (
            <li key={r.id}>
              <Card className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl font-bold">{r.conversation_title}</h2>
                  <span className="text-base text-ink-soft">{formatDateTime(r.created_at, tz)}</span>
                </div>
                <dl className="grid gap-x-6 gap-y-1 text-base sm:grid-cols-2">
                  <div><dt className="inline font-semibold">Người báo cáo: </dt><dd className="inline">{r.reporter_name}</dd></div>
                  <div><dt className="inline font-semibold">Người gửi tin: </dt><dd className="inline">{r.reported_name}</dd></div>
                  <div><dt className="inline font-semibold">Lý do: </dt><dd className="inline">{REASONS[r.reason_kind]}</dd></div>
                  <div><dt className="inline font-semibold">Tin hiện tại: </dt><dd className="inline">{r.message_deleted ? "đã bị xoá/ẩn" : "còn hiển thị"}</dd></div>
                </dl>
                {r.note && <p className="text-base"><span className="font-semibold">Ghi chú của người báo cáo: </span>{r.note}</p>}
                <blockquote className="whitespace-pre-wrap break-words rounded-xl border-l-4 border-wine bg-champagne-soft px-4 py-3 text-lg [overflow-wrap:anywhere]">
                  {r.message_snapshot}
                </blockquote>

                {r.status === "open" ? (
                  <form action={resolveReport} className="space-y-3">
                    <input type="hidden" name="report" value={r.id} />
                    <label className="block text-base font-semibold">
                      Ghi chú xử lý (không bắt buộc)
                      <input name="note" maxLength={500} className="mt-1 block min-h-12 w-full rounded-xl border border-ink-soft/40 bg-white px-4 py-2 text-base font-normal" />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button name="decision" value="dismiss" className={buttonGhostClass}>Bỏ qua (không vi phạm)</button>
                      <ChatConfirmButton name="decision" value="hide_message" className={buttonClass}
                        message="Ẩn tin nhắn này? Nội dung sẽ bị xoá khỏi cuộc trò chuyện.">
                        Ẩn tin nhắn
                      </ChatConfirmButton>
                      {r.conversation_kind !== "direct" && r.reported_user_id && (
                        <>
                          <ChatConfirmButton name="decision" value="remove_member" className={dangerBtn}
                            message={`Gỡ ${r.reported_name} khỏi “${r.conversation_title}”? Người này sẽ không đọc hay gửi được trong nhóm nữa.`}>
                            Gỡ người gửi khỏi nhóm
                          </ChatConfirmButton>
                          <ChatConfirmButton name="decision" value="hide_and_remove" className={dangerBtn}
                            message={`Ẩn tin nhắn và gỡ ${r.reported_name} khỏi “${r.conversation_title}”?`}>
                            Ẩn tin và gỡ khỏi nhóm
                          </ChatConfirmButton>
                        </>
                      )}
                    </div>
                  </form>
                ) : (
                  <p className="text-base">
                    <span className="font-semibold">{r.action_taken ? ACTION_LABELS[r.action_taken] : "Đã xử lý"}</span>
                    {r.resolved_by_name ? ` bởi ${r.resolved_by_name}` : ""}
                    {r.resolved_at ? ` lúc ${formatDateTime(r.resolved_at, tz)}` : ""}
                    {r.resolution_note ? `. Ghi chú: ${r.resolution_note}` : ""}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
