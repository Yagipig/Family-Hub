import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chatAllowed, loadUserTimezone } from "@/lib/chat-server";
import { PAGE_SIZE, type ChatMessage, type ConversationRow, type MemberRow } from "@/lib/chat";
import { idSchema } from "@/lib/chat-schemas";
import { Avatar } from "@/components/Avatar";
import { ChatRoom } from "@/components/ChatRoom";

export const metadata = { title: "Tin nhắn" };

const KIND_LABEL = { family: "Nhóm cả gia đình", branch: "Nhóm nhánh họ", group: "Nhóm", direct: "Nhắn riêng" } as const;

export default async function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const supabase = await createClient();

  // Chỉ thấy được khi còn là thành viên đang hoạt động (view lọc theo membership; RLS/Realtime dùng cùng điều kiện)
  const { data: convData } = await supabase.from("chat_conversations_v").select("*").eq("id", id).maybeSingle();
  if (!convData) notFound();
  const conv = convData as ConversationRow;

  const [{ data: msgData }, { data: memberData }, tz, canSend] = await Promise.all([
    supabase.from("chat_messages_v").select("*").eq("conversation_id", id).order("created_at", { ascending: false }).limit(PAGE_SIZE),
    supabase.from("chat_members_v").select("*").eq("conversation_id", id),
    loadUserTimezone(supabase, session.userId),
    chatAllowed(supabase, session.familyId, "create"),
  ]);
  const newestFirst = (msgData ?? []) as ChatMessage[];
  const initialMessages = [...newestFirst].reverse();
  const members = (memberData ?? []) as MemberRow[];

  const sendBlockedNote = conv.i_blocked
    ? "Bạn đã chặn người này nên không nhắn được. Muốn nhắn lại, hãy vào “Thành viên và tuỳ chọn” để bỏ chặn."
    : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/tin-nhan" className="inline-flex min-h-12 items-center rounded-xl border border-wine px-4 text-base font-semibold text-wine hover:bg-champagne-soft">
          ← Danh sách
        </Link>
        <Avatar name={conv.title} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-wine">{conv.title}</h1>
          <p className="text-base text-ink-soft">
            {KIND_LABEL[conv.kind]}
            {conv.kind !== "direct" ? ` · ${conv.member_count} người` : ""}
            {conv.muted ? " · Đã tắt thông báo" : ""}
          </p>
        </div>
        <Link
          href={`/tin-nhan/${id}/thanh-vien`}
          className="inline-flex min-h-12 items-center rounded-xl border border-wine px-4 text-base font-semibold text-wine hover:bg-champagne-soft"
        >
          Thành viên và tuỳ chọn
        </Link>
      </div>

      <ChatRoom
        key={id}
        conversationId={id}
        kind={conv.kind}
        me={{ userId: session.userId, displayName: session.displayName }}
        timeZone={tz}
        canSend={canSend}
        sendBlockedNote={sendBlockedNote}
        canModerate={conv.can_moderate}
        initialMessages={initialMessages}
        initialHasMore={newestFirst.length === PAGE_SIZE}
        members={members.map((m) => ({ user_id: m.user_id, display_name: m.display_name }))}
      />
    </>
  );
}
