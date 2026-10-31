import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chatAllowed, loadUserTimezone } from "@/lib/chat-server";
import { formatListTime, type ConversationRow } from "@/lib/chat";
import { normalizeSearch, unreadLabel } from "@/lib/chat-text";
import { Alert, Card } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { ChatAutoRefresh } from "@/components/ChatAutoRefresh";

export const metadata = { title: "Tin nhắn" };

// Muc Tin nhan mang tong xanh duong rieng theo mau thiet ke nguoi dung gui 31/10/2026 (app chat gia dinh).
const chatBtn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-sky-600 px-5 py-2 text-base font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60";

const KIND_LABEL: Record<ConversationRow["kind"], string> = {
  family: "Cả gia đình",
  branch: "Nhóm nhánh",
  group: "Nhóm",
  direct: "Nhắn riêng",
};

export default async function ChatListPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string }> }) {
  const session = await requireSession();
  const { q = "", ok, error } = await searchParams;
  const supabase = await createClient();

  if (!(await chatAllowed(supabase, session.familyId, "view"))) {
    return (
      <>
        <h1 className="text-3xl font-bold text-wine">Tin nhắn</h1>
        <Alert kind="error">Tài khoản của bạn (khách) chưa được dùng tính năng Tin nhắn. Hãy liên hệ quản trị viên nếu cần.</Alert>
      </>
    );
  }

  // Đảm bảo nhóm cả gia đình / nhóm nhánh đã có (lười, idempotent; trigger ở CSDL đã làm khi quyền thay đổi)
  await supabase.rpc("ensure_chat_groups", { p_family: session.familyId });

  const [{ data }, tz, myProfile] = await Promise.all([
    supabase.from("chat_conversations_v").select("*").order("last_activity_at", { ascending: false }).limit(200),
    loadUserTimezone(supabase, session.userId),
    supabase.from("user_profiles").select("alias_name, display_name").eq("id", session.userId).maybeSingle(),
  ]);
  // Tên hiển thị của chính tôi trong trò chuyện (ưu tiên tên gọi khác, khớp cách view đặt tên người gửi)
  // để nhận ra tin cuối là của mình mà hiện tiền tố “Bạn:”. View chưa có mã người gửi cuối nên tạm so theo tên.
  const myChatName = myProfile.data?.alias_name?.trim() || myProfile.data?.display_name || session.displayName;
  const previewOf = (c: ConversationRow): string => {
    if (!c.last_preview) return "Chưa có tin nhắn";
    if (c.last_sender_name && c.last_sender_name === myChatName) return `Bạn: ${c.last_preview}`;
    if (c.last_sender_name && c.kind !== "direct") return `${c.last_sender_name}: ${c.last_preview}`;
    return c.last_preview;
  };
  const needle = normalizeSearch(q.slice(0, 80));
  const all = ((data ?? []) as ConversationRow[])
    // tin nhắn riêng chưa có tin nào thì chưa hiện
    .filter((c) => c.kind !== "direct" || c.last_preview !== null);
  const rows = needle ? all.filter((c) => normalizeSearch(c.title).includes(needle)) : all;
  const totalUnread = all.reduce((n, c) => n + (c.muted ? 0 : c.unread_count), 0);

  return (
    <>
      <ChatAutoRefresh />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-wine">
          Tin nhắn{totalUnread > 0 && <span className="ml-3 rounded-full bg-red-500 px-3 py-1 align-middle text-base text-white">{unreadLabel(totalUnread)} chưa đọc</span>}
        </h1>
        <Link href="/tin-nhan/moi" className={chatBtn}>Tin nhắn mới</Link>
      </div>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <form method="get" action="/tin-nhan" role="search" className="flex flex-wrap gap-2">
        <label className="min-w-0 flex-1 text-base font-semibold">
          <span className="sr-only">Tìm cuộc trò chuyện</span>
          <input
            name="q"
            defaultValue={q}
            maxLength={80}
            placeholder="Tìm theo tên người hoặc nhóm…"
            className="block min-h-12 w-full rounded-full border border-sky-300/80 bg-white px-5 py-2 text-base font-normal text-ink"
          />
        </label>
        <button className={chatBtn}>Tìm</button>
        {q && <Link href="/tin-nhan" className="inline-flex min-h-12 items-center px-3 text-base font-semibold text-wine underline">Xoá tìm kiếm</Link>}
      </form>

      {rows.length === 0 ? (
        <Card>
          <p className="text-lg text-ink-soft">
            {needle ? "Không tìm thấy cuộc trò chuyện phù hợp." : "Chưa có cuộc trò chuyện nào. Bấm “Tin nhắn mới” để bắt đầu."}
          </p>
        </Card>
      ) : (
        <ul className="divide-y divide-sky-100 overflow-hidden rounded-2xl border border-sky-200/70 bg-ivory shadow-sm" aria-label="Các cuộc trò chuyện">
          {rows.map((c) => {
            const unread = c.unread_count > 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/tin-nhan/${c.id}`}
                  className={`flex items-center gap-3 px-4 py-3 focus-visible:outline-none ${unread ? "bg-sky-50 hover:bg-sky-100/70" : "hover:bg-sky-50/70"}`}
                >
                  <Avatar name={c.title} size={56} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-x-2">
                      <span className={`truncate text-lg text-ink ${unread ? "font-bold" : "font-semibold"}`}>{c.title}</span>
                      <span className="shrink-0 text-sm text-ink-soft">{KIND_LABEL[c.kind]}{c.kind !== "direct" ? ` · ${c.member_count} người` : ""}{c.muted ? " · Đã tắt thông báo" : ""}</span>
                    </div>
                    <p className={`mt-0.5 truncate text-base ${unread ? "font-semibold text-ink" : "text-ink-soft"}`}>
                      {previewOf(c)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 self-start pt-1">
                    <span className={`whitespace-nowrap text-sm ${unread ? "font-bold text-sky-700" : "text-ink-soft"}`} suppressHydrationWarning>
                      {c.last_preview ? formatListTime(c.last_activity_at, tz) : ""}
                    </span>
                    {unread && (
                      <span
                        className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-red-500 px-2 text-sm font-bold text-white"
                        aria-label={`${c.unread_count >= 100 ? "Hơn 99" : c.unread_count} tin chưa đọc`}
                      >
                        {unreadLabel(c.unread_count)}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
