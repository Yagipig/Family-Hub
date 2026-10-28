import Link from "next/link";
import { redirect } from "next/navigation";
import { can, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { Alert, Card, buttonClass, buttonGhostClass } from "@/components/ui";
import { fetchAll } from "@/lib/members-data";
import { restoreMemberAction } from "../actions";

export const metadata = { title: "Thùng rác thành viên" };

export default async function MembersTrashPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireSession();
  // Quyền thật nằm ở view (members_trash_v chỉ trả dữ liệu cho người có quyền xóa); chặn sớm để khỏi hiện trang rỗng
  if (session.role === "guest" || !(await can(session, "members", "delete"))) redirect("/thanh-vien");
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const rows = await fetchAll<{ id: string; full_name: string; deleted_at: string }>((a, b) =>
    supabase.from("members_trash_v").select("id, full_name, deleted_at").order("deleted_at", { ascending: false }).order("id").range(a, b));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-3xl font-bold text-wine">Thùng rác thành viên</h1>
        <Link href="/thanh-vien" className={buttonGhostClass}>Về danh sách</Link>
      </div>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      <p className="text-base text-ink-soft">Hồ sơ đã xóa vẫn được giữ lại. Khôi phục sẽ đưa hồ sơ và các quan hệ của nó trở lại danh sách và cây gia phả.</p>
      <Card>
        {rows.length === 0 ? (
          <p className="text-base text-ink-soft">Thùng rác trống.</p>
        ) : (
          <ul className="divide-y divide-champagne/50">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold">{r.full_name}</span>
                  <span className="block text-sm text-ink-soft">Xóa lúc {formatDateTime(r.deleted_at, session.timezone)}</span>
                </span>
                <form action={restoreMemberAction}>
                  <input type="hidden" name="memberId" value={r.id} />
                  <button className={buttonClass}>Khôi phục</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
