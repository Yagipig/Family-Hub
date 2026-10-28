import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ConversationRow, type MemberRow, type PersonRow } from "@/lib/chat";
import { idSchema } from "@/lib/chat-schemas";
import { Alert, Card, Field, SelectField, buttonClass, buttonGhostClass } from "@/components/ui";
import { ConfirmButton } from "@/components/SubmitButton";
import { addMember, blockUser, leaveGroup, removeMember, renameGroup, setMuted, unblockUser } from "../actions";

export const metadata = { title: "Thành viên và tuỳ chọn cuộc trò chuyện" };

const dangerBtn =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-danger px-5 py-2 text-base font-semibold text-danger hover:bg-red-50";

export default async function ChatMembersPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireSession();
  const { id } = await params;
  const { ok, error } = await searchParams;
  if (!idSchema.safeParse(id).success) notFound();
  const supabase = await createClient();

  const { data: convData } = await supabase.from("chat_conversations_v").select("*").eq("id", id).maybeSingle();
  if (!convData) notFound();
  const conv = convData as ConversationRow;
  const [{ data: memberData }, { data: peopleData }] = await Promise.all([
    supabase.from("chat_members_v").select("*").eq("conversation_id", id).order("joined_at"),
    supabase.from("chat_people_v").select("*").order("display_name"),
  ]);
  const members = (memberData ?? []) as MemberRow[];
  const inRoom = new Set(members.map((m) => m.user_id));
  const candidates = ((peopleData ?? []) as PersonRow[]).filter((p) => !inRoom.has(p.user_id));
  const isGroup = conv.kind === "group";
  const canManage = conv.can_moderate && conv.kind !== "direct";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/tin-nhan/${id}`} className={buttonGhostClass}>← Về cuộc trò chuyện</Link>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold text-wine">{conv.title}</h1>
      </div>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Thông báo</h2>
        <p className="text-base text-ink-soft">
          {conv.muted ? "Bạn đang tắt thông báo cuộc trò chuyện này. Tin mới vẫn hiện trong danh sách." : "Bạn sẽ nhận một thông báo gộp khi có tin mới chưa đọc."}
        </p>
        <form action={setMuted}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="muted" value={conv.muted ? "0" : "1"} />
          <button className={buttonClass}>{conv.muted ? "Bật lại thông báo" : "Tắt thông báo cuộc này"}</button>
        </form>
      </Card>

      {isGroup && conv.can_moderate && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Đổi tên nhóm</h2>
          <form action={renameGroup} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={id} />
            <div className="min-w-0 flex-1"><Field label="Tên nhóm" name="title" defaultValue={conv.title} required maxLength={100} /></div>
            <button className={buttonClass}>Lưu tên</button>
          </form>
        </Card>
      )}

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Thành viên ({members.length})</h2>
        {conv.kind === "family" && <p className="text-base text-ink-soft">Mọi thành viên của gia đình tự động ở trong nhóm này và không thể rời nhóm.</p>}
        {conv.kind === "branch" && <p className="text-base text-ink-soft">Nhóm này gồm các thành viên thuộc nhánh; khi đổi nhánh, bạn sẽ tự chuyển sang nhóm nhánh mới.</p>}
        <ul className="divide-y divide-champagne/50">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1 text-lg">
                {m.display_name}
                {m.is_me && <span className="ml-2 text-base text-ink-soft">(bạn)</span>}
                {m.role === "owner" && <span className="ml-2 rounded-full bg-champagne-soft px-3 py-1 text-sm font-semibold text-wine">Chủ nhóm</span>}
              </span>
              {canManage && !m.is_me && (
                <form action={removeMember}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="userId" value={m.user_id} />
                  <ConfirmButton className={dangerBtn} message={`Gỡ ${m.display_name} khỏi cuộc trò chuyện này?`}>Gỡ khỏi nhóm</ConfirmButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {canManage && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Thêm thành viên</h2>
          {conv.kind === "branch" && <p className="text-base text-ink-soft">Chỉ thêm được người thuộc đúng nhánh này (ví dụ để khôi phục người từng bị gỡ).</p>}
          {candidates.length === 0 ? (
            <p className="text-base text-ink-soft">Không còn ai để thêm.</p>
          ) : (
            <form action={addMember} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={id} />
              <div className="min-w-0 flex-1">
                <SelectField label="Chọn người" name="userId" defaultValue="" required>
                  <option value="" disabled>— Chọn —</option>
                  {candidates.map((p) => (
                    <option key={p.user_id} value={p.user_id}>{p.display_name}{p.branch_name ? ` (${p.branch_name})` : ""}</option>
                  ))}
                </SelectField>
              </div>
              <button className={buttonClass}>Thêm vào</button>
            </form>
          )}
        </Card>
      )}

      {conv.kind === "direct" && conv.direct_user_id && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Chặn nhắn riêng</h2>
          <p className="text-base text-ink-soft">
            Khi chặn, hai bên không gửi được tin nhắn riêng cho nhau. Việc chặn không ảnh hưởng tới các nhóm chung và người kia không được báo là đã bị chặn.
          </p>
          {conv.i_blocked ? (
            <form action={unblockUser}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="userId" value={conv.direct_user_id} />
              <button className={buttonClass}>Bỏ chặn {conv.title}</button>
            </form>
          ) : (
            <form action={blockUser}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="userId" value={conv.direct_user_id} />
              <ConfirmButton className={dangerBtn} message={`Chặn ${conv.title} nhắn riêng với bạn?`}>Chặn {conv.title}</ConfirmButton>
            </form>
          )}
        </Card>
      )}

      {isGroup && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Rời nhóm</h2>
          <p className="text-base text-ink-soft">Sau khi rời, bạn không còn đọc được nhóm này (kể cả tin cũ). Người quản lý nhóm có thể thêm bạn lại; khi đó bạn chỉ thấy tin từ lúc được thêm lại.</p>
          <form action={leaveGroup}>
            <input type="hidden" name="id" value={id} />
            <ConfirmButton className={dangerBtn} message="Rời nhóm này? Bạn sẽ không đọc được tin trong nhóm nữa.">Rời nhóm</ConfirmButton>
          </form>
        </Card>
      )}
    </>
  );
}
