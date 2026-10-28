import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chatAllowed } from "@/lib/chat-server";
import type { PersonRow } from "@/lib/chat";
import { Alert, Card, Field, buttonClass, buttonGhostClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ChatPeoplePicker } from "@/components/ChatPeoplePicker";
import { createGroup, startDirect } from "./actions";

export const metadata = { title: "Tin nhắn mới" };

export default async function NewChatPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireSession();
  const { ok, error } = await searchParams;
  const supabase = await createClient();

  if (!(await chatAllowed(supabase, session.familyId, "create"))) {
    return (
      <>
        <h1 className="text-3xl font-bold text-wine">Tin nhắn mới</h1>
        <Alert kind="error">Tài khoản của bạn chưa được gửi tin nhắn. Hãy liên hệ quản trị viên nếu cần.</Alert>
        <Link href="/tin-nhan" className={buttonGhostClass}>← Về danh sách</Link>
      </>
    );
  }

  const { data } = await supabase.from("chat_people_v").select("*").order("display_name");
  const people = (data ?? []) as PersonRow[];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/tin-nhan" className={buttonGhostClass}>← Danh sách</Link>
        <h1 className="text-3xl font-bold text-wine">Tin nhắn mới</h1>
      </div>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Nhắn riêng cho một người</h2>
        <p className="text-base text-ink-soft">Chỉ hai người đọc được. Mỗi cặp chỉ có một cuộc trò chuyện riêng.</p>
        {people.length === 0 ? (
          <p className="text-base text-ink-soft">Chưa có ai khác trong gia đình dùng tin nhắn.</p>
        ) : (
          <ul className="divide-y divide-champagne/50">
            {people.map((p) => (
              <li key={p.user_id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-0 flex-1 text-lg">
                  {p.display_name}
                  {p.branch_name && <span className="ml-2 text-base text-ink-soft">({p.branch_name})</span>}
                </span>
                <form action={startDirect}>
                  <input type="hidden" name="userId" value={p.user_id} />
                  <button className={buttonClass} aria-label={`Nhắn riêng cho ${p.display_name}`}>Nhắn tin</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Tạo nhóm</h2>
        <p className="text-base text-ink-soft">Bạn là chủ nhóm: thêm hoặc gỡ người, đổi tên nhóm. Người được thêm chỉ đọc được tin từ lúc họ vào nhóm.</p>
        <form action={createGroup} className="space-y-4">
          <Field label="Tên nhóm" name="title" required maxLength={100} placeholder="Ví dụ: Cả nhà đi Đà Lạt" />
          <ChatPeoplePicker people={people} />
          <SubmitButton pendingText="Đang tạo nhóm…">Tạo nhóm</SubmitButton>
        </form>
      </Card>
    </>
  );
}
