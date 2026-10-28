import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { can, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/ui";
import { AlbumView, type AlbumInfo, type PhotoInfo } from "./AlbumView";

export const metadata = { title: "Album ảnh" };
const PAGE_SIZE = 48;

export default async function MemberAlbumPage({
  params, searchParams,
}: { params: Promise<{ memberId: string }>; searchParams: Promise<{ album?: string; trang?: string }> }) {
  const session = await requireSession();
  const { memberId } = await params;
  if (!z.uuid().safeParse(memberId).success) notFound();
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: member } = await supabase.from("members_view")
    .select("id, full_name, nickname, avatar_path, branch_id, is_self, family_id").eq("id", memberId).maybeSingle();
  if (!member || member.family_id !== session.familyId) notFound();

  const [{ data: albumRows }, { data: canAddRaw }] = await Promise.all([
    supabase.from("albums_v").select("id, title, description, visibility, is_default, created_by, item_count, cover_path")
      .eq("member_id", memberId).order("is_default", { ascending: false }).order("updated_at", { ascending: false }),
    supabase.rpc("can_add_to_album", { p_member: memberId }),
  ]);
  const albums = (albumRows ?? []) as (AlbumInfo & { created_by: string | null; cover_path: string | null })[];
  const canAdd = canAddRaw === true;
  const wanted = z.uuid().safeParse(sp.album).success ? sp.album : undefined;
  const current = albums.find((a) => a.id === wanted) ?? albums.find((a) => a.is_default) ?? albums[0] ?? null;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(sp.trang ?? "1", 10) || 1));

  const isOwner = member.is_self === true || (current?.created_by ?? null) === session.userId;
  const [moderator, memberEditor] = await Promise.all([
    can(session, "posts", "delete", member.branch_id as string | null),
    can(session, "members", "update", member.branch_id as string | null),
  ]);

  let photos: PhotoInfo[] = [];
  let total = 0;
  if (current) {
    total = Number(current.item_count) || 0;
    const from = (page - 1) * PAGE_SIZE;
    const { data: items } = await supabase.from("album_items_v")
      .select("id, media_id, caption, thumb_path, path, width, height, added_by, people, created_at")
      .eq("album_id", current.id).order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    const rows = (items ?? []) as { id: string; media_id: string; caption: string | null; thumb_path: string | null; path: string; width: number | null; height: number | null; added_by: string | null; people: string[] | null }[];
    const urls = await signedUrls("family-media", rows.flatMap((r) => [r.thumb_path ?? r.path, r.path]));
    photos = rows.flatMap((r) => {
      const full = urls[r.path];
      const thumb = urls[r.thumb_path ?? r.path] ?? full;
      if (!full || !thumb) return [];
      return [{
        id: r.id, mediaId: r.media_id, caption: r.caption, thumbUrl: thumb, fullUrl: full,
        canManage: isOwner || moderator || r.added_by === session.userId, people: r.people ?? [],
      }];
    });
  }

  // Tên thành viên để gắn thẻ (chỉ tải khi người xem có thể gắn thẻ)
  const canTag = isOwner || moderator || photos.some((p) => p.canManage);
  const { data: roster } = canTag
    ? await supabase.from("members_view").select("id, full_name").eq("family_id", session.familyId).order("full_name").limit(500)
    : { data: [] as { id: string; full_name: string }[] };
  const names: Record<string, string> = {};
  const needNames = new Set(photos.flatMap((p) => p.people));
  if (!canTag && needNames.size > 0) {
    const { data } = await supabase.from("members_view").select("id, full_name").in("id", [...needNames].slice(0, 200));
    for (const m of data ?? []) names[m.id as string] = m.full_name as string;
  }
  for (const m of roster ?? []) names[m.id as string] = m.full_name as string;

  const avatarUrls = await signedUrls("avatars", [member.avatar_path as string | null]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => `/album/${memberId}?${new URLSearchParams({ ...(current ? { album: current.id } : {}), trang: String(p) })}`;

  return (
    <>
      <Link href="/album" className="inline-flex min-h-12 items-center text-base font-semibold text-wine underline">← Tất cả album</Link>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={member.avatar_path ? avatarUrls[member.avatar_path as string] : null} name={member.full_name as string} size={72} />
        <div>
          <h1 className="text-3xl font-bold text-wine">Album của {member.full_name}</h1>
          <Link href={`/thanh-vien/${memberId}`} className="text-base text-wine underline">Xem hồ sơ</Link>
        </div>
      </div>

      <AlbumView
        memberId={memberId}
        albums={albums.map((a) => ({ id: a.id, title: a.title, description: a.description, visibility: a.visibility, is_default: a.is_default, item_count: Number(a.item_count) }))}
        currentId={current?.id ?? null}
        photos={photos}
        names={names}
        roster={(roster ?? []).map((m) => ({ id: m.id as string, name: m.full_name as string }))}
        canAdd={canAdd}
        canEditAlbum={!!current && (isOwner || memberEditor)}
        canDeleteAlbum={!!current && (isOwner || moderator)}
        canTag={canTag}
        total={total}
      />

      {pages > 1 && (
        <nav aria-label="Phân trang ảnh" className="flex flex-wrap items-center justify-center gap-3">
          {page > 1 && <Link href={link(page - 1)} className="inline-flex min-h-12 items-center rounded-xl border border-wine px-5 text-base font-semibold text-wine">← Trang trước</Link>}
          <span className="text-base">Trang {page} / {pages}</span>
          {page < pages && <Link href={link(page + 1)} className="inline-flex min-h-12 items-center rounded-xl border border-wine px-5 text-base font-semibold text-wine">Trang sau →</Link>}
        </nav>
      )}
      {!canAdd && albums.length === 0 && (
        <Card><p className="text-lg">Album này chưa có ảnh.</p></Card>
      )}
    </>
  );
}
