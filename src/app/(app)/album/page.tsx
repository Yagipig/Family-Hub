import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { Avatar } from "@/components/Avatar";
import { Card, Field, buttonClass } from "@/components/ui";

export const metadata = { title: "Album gia đình" };

type Row = { id: string; full_name: string; nickname: string | null; avatar_path: string | null; is_deceased: boolean };

export default async function AlbumIndexPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireSession();
  const { q: qRaw } = await searchParams;
  const q = (qRaw ?? "").trim().slice(0, 60);
  const supabase = await createClient();

  const [{ data: counts }, { data: me }] = await Promise.all([
    supabase.from("album_member_counts_v").select("member_id, photo_count, last_added").eq("family_id", session.familyId),
    supabase.rpc("my_member_id", { p_family: session.familyId }),
  ]);
  const countMap = new Map((counts ?? []).map((c) => [c.member_id as string, Number(c.photo_count)]));
  const memberIds = [...countMap.keys()];

  // Chỉ liệt kê người đã có ảnh mà mình xem được; người tìm kiếm thì tìm trong cả gia đình.
  let query = supabase.from("members_view").select("id, full_name, nickname, avatar_path, is_deceased").eq("family_id", session.familyId);
  if (q) query = query.ilike("full_name", `%${q.replace(/[%_\\]/g, "")}%`).limit(60);
  else if (memberIds.length > 0) query = query.in("id", memberIds.slice(0, 200));
  const { data: members } = memberIds.length > 0 || q ? await query.order("full_name") : { data: [] as Row[] };
  const rows = (members ?? []) as Row[];
  const urls = await signedUrls("avatars", rows.map((m) => m.avatar_path));
  const myId = typeof me === "string" ? me : null;

  return (
	    <>
	      <h1 className="text-2xl font-bold tracking-tight text-wine md:text-3xl">Album gia đình</h1>
	      <p className="text-base text-ink-soft">Mỗi thành viên có album ảnh riêng. Chọn người để xem.</p>

      <Card className="space-y-4">
        <form className="flex flex-wrap items-end gap-3" role="search">
          <div className="min-w-[14rem] flex-1">
            <Field label="Tìm thành viên" name="q" defaultValue={q} placeholder="Gõ một phần tên" maxLength={60} />
          </div>
          <button className={buttonClass}>Tìm</button>
	          {q && <Link href="/album" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-wine underline">Xóa</Link>}
        </form>
        {myId && (
          <Link href={`/album/${myId}`} className={buttonClass}>Album của tôi</Link>
        )}
      </Card>

      {rows.length === 0 ? (
        <Card><p className="text-lg">{q ? "Không tìm thấy thành viên nào." : "Chưa có ảnh nào trong album gia đình."}</p></Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => {
            const n = countMap.get(m.id) ?? 0;
            return (
              <li key={m.id}>
                <Link href={`/album/${m.id}`} className="flex min-h-20 items-center gap-4 rounded-2xl border border-champagne/60 bg-ivory p-4 shadow-sm hover:border-wine">
                  <Avatar src={m.avatar_path ? urls[m.avatar_path] : null} name={m.full_name} size={64} />
                  <span className="min-w-0">
                    <span className="block truncate text-xl font-bold">{m.full_name}</span>
                    {m.nickname && <span className="block truncate text-base text-ink-soft">({m.nickname})</span>}
                    <span className="block text-base text-wine">{n > 0 ? `${n} ảnh` : "Chưa có ảnh"}{m.is_deceased ? " · Đã mất" : ""}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
