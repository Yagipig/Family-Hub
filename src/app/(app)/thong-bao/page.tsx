import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, buttonClass, buttonGhostClass } from "@/components/ui";
import { getViewer } from "@/lib/events-server";
import { formatDateTime } from "@/lib/format";
import { markAllRead, markOneRead, openNotification } from "./actions";
import Link from "next/link";

export const metadata = { title: "Thông báo" };

const KIND_LABEL: Record<string, string> = {
  birthday: "Sinh nhật", death_anniversary: "Ngày giỗ", event: "Sự kiện", event_reminder: "Nhắc sự kiện", card: "Thiệp",
  gift: "Quà", chat: "Tin nhắn", change_request: "Yêu cầu chỉnh sửa", system: "Hệ thống",
};

export default async function NotificationsPage() {
  const session = await requireSession();
  const viewer = await getViewer(session);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <>
	      <div className="flex flex-wrap items-center gap-2">
	        <h1 className="text-2xl font-bold tracking-tight text-wine md:text-3xl">Thông báo</h1>
	        <div className="ml-auto flex flex-wrap gap-2">
	          {unread > 0 && (
	            <form action={markAllRead}><button className={buttonGhostClass + " text-sm"}>Đã đọc hết</button></form>
	          )}
	          <Link href="/cai-dat/thong-bao" className={buttonGhostClass + " text-sm"}>Tuỳ chọn</Link>
	        </div>
	      </div>
      {error && <p role="alert" className="text-base text-danger">Không tải được thông báo. Vui lòng thử lại.</p>}
      {!error && rows.length === 0 && <Card><p className="text-base text-ink-soft">Bạn chưa có thông báo nào.</p></Card>}
      <ul className="space-y-3">
        {rows.map((n) => (
          <li key={n.id}>
            <Card className={`!p-4 ${n.read_at ? "opacity-80" : "border-wine/60"}`}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold text-ink-soft">
                    {!n.read_at && <span className="mr-2 rounded-full bg-wine px-2 py-0.5 text-xs text-white">Mới</span>}
                    {KIND_LABEL[n.kind as string] ?? "Thông báo"} · {formatDateTime(n.created_at as string, viewer.viewerTz)}
                  </p>
                  <p className="text-lg font-bold">{n.title}</p>
                  {n.body && <p className="whitespace-pre-line text-base">{n.body}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {n.link && (
                    <form action={openNotification}>
                      <input type="hidden" name="id" value={n.id} />
                      <button className={buttonClass}>Mở</button>
                    </form>
                  )}
                  {!n.read_at && (
                    <form action={markOneRead}>
                      <input type="hidden" name="id" value={n.id} />
                      <button className={buttonGhostClass}>Đã đọc</button>
                    </form>
                  )}
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {rows.length === 100 && <p className="text-sm text-ink-soft">Chỉ hiện 100 thông báo gần nhất.</p>}
    </>
  );
}
