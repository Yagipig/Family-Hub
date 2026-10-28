import Link from "next/link";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";

/**
 * Thẻ "Album" nhúng vào trang hồ sơ thành viên: vài ảnh mới nhất + liên kết tới /album/<memberId>.
 * Cách dùng (người tích hợp): <MemberAlbumStrip memberId={member.id} />  (Server Component).
 * Chỉ hiện ảnh mà người xem được phép xem (RLS: album 'family' / 'branch' / 'owner').
 */
export async function MemberAlbumStrip({ memberId, limit = 8 }: { memberId: string; limit?: number }) {
  const supabase = await createClient();
  const [{ data: rows }, { count }, { data: canAdd }] = await Promise.all([
    supabase.from("album_items_v").select("id, thumb_path, path, bucket, caption")
      .eq("member_id", memberId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("album_items_v").select("id", { count: "exact", head: true }).eq("member_id", memberId),
    supabase.rpc("can_add_to_album", { p_member: memberId }),
  ]);
  const photos = (rows ?? []) as { id: string; thumb_path: string | null; path: string; caption: string | null }[];
  const urls = await signedUrls("family-media", photos.map((p) => p.thumb_path ?? p.path));
  const total = count ?? photos.length;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Album ảnh{total > 0 ? ` (${total})` : ""}</h2>
        <Link href={`/album/${memberId}`} className="inline-flex min-h-12 items-center rounded-xl border border-wine px-5 text-base font-semibold text-wine hover:bg-champagne-soft">
          {total > 0 ? "Xem tất cả ảnh" : canAdd === true ? "Thêm ảnh đầu tiên" : "Mở album"}
        </Link>
      </div>
      {photos.length === 0 ? (
        <p className="text-base text-ink-soft">Chưa có ảnh nào trong album.</p>
      ) : (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {photos.map((p) => {
            const src = urls[p.thumb_path ?? p.path];
            return (
              <li key={p.id} className="aspect-square overflow-hidden rounded-lg bg-champagne-soft">
                <Link href={`/album/${memberId}`} aria-label={p.caption ?? "Xem ảnh trong album"} className="block h-full w-full">
                  {src && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={p.caption ?? "Ảnh trong album"} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
