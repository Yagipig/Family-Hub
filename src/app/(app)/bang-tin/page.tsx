import { can, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { FamilyCover } from "@/components/FamilyCover";
import { Composer } from "./Composer";
import { Feed } from "./Feed";
import { NotifyToggle } from "./NotifyToggle";
import { loadFeed } from "./feed-data";

export const metadata = { title: "Bảng tin gia đình" };

export default async function FeedPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const canView = await can(session, "posts", "view");
  if (!canView) {
    return <Card><p className="text-lg">Bạn chưa có quyền xem bảng tin của gia đình.</p></Card>;
  }
  const isGuest = session.role === "guest";
  const [canCreate, pinned, page, { data: pref }] = await Promise.all([
    isGuest ? Promise.resolve(false) : can(session, "posts", "create"),
    loadFeed(session.familyId, { pinned: true }),
    loadFeed(session.familyId),
    supabase.from("post_notification_prefs").select("comments").eq("user_id", session.userId).eq("family_id", session.familyId).maybeSingle(),
  ]);
  // Đổi khóa khi dữ liệu trang đầu thay đổi (đăng bài / ghim / ẩn) để danh sách làm mới
  const feedKey = [...pinned.posts, ...page.posts].map((p) => `${p.id}${p.pinned ? "p" : ""}${p.hidden ? "h" : ""}`).join(",");

  return (
    <>
	      <FamilyCover>
	        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Bảng tin {session.familyName}</h1>
	        <p className="mt-1 text-base opacity-90">Chia sẻ tin vui, ảnh và lời hỏi thăm.</p>
	      </FamilyCover>

      {canCreate ? (
        <Composer hasBranch={session.branchId !== null} />
      ) : (
        <Card><p className="text-lg">Tài khoản của bạn chỉ được xem bảng tin, không đăng bài hoặc bình luận.</p></Card>
      )}

      {!isGuest && <NotifyToggle initial={pref?.comments ?? true} />}

      <Feed key={feedKey} pinned={pinned.posts} initial={page.posts} initialNext={page.next} timezone={session.timezone} canInteract={!isGuest} />
    </>
  );
}
