import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import type { FeedComment, FeedCursor, FeedMedia, FeedPost } from "./feed-types";
import { FEED_PAGE_SIZE } from "./feed-types";

type RawPost = {
  id: string; author_name: string; author_member_id: string | null; author_avatar: string | null; body: string;
  visibility: string; pinned: boolean; hidden: boolean; hide_reason: string | null; created_at: string; edited_at: string | null;
  comment_count: number; reactions: Record<string, number> | null; my_reaction: string | null;
  media: { id: string; path: string; thumb_path: string | null }[] | null; can_moderate: boolean; is_mine: boolean;
};

/** Gọi feed_page rồi ký URL ảnh (bài viết) và ảnh đại diện (đã được members_view che theo quyền riêng tư). */
export async function loadFeed(familyId: string, opts: { cursor?: FeedCursor | null; pinned?: boolean } = {}): Promise<{ posts: FeedPost[]; next: FeedCursor | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("feed_page", {
    p_family: familyId, p_before: opts.cursor?.before ?? null, p_before_id: opts.cursor?.beforeId ?? null,
    p_limit: FEED_PAGE_SIZE, p_pinned: opts.pinned ?? false,
  });
  if (error) throw new Error("feed_page failed");
  const rows = (data ?? []) as RawPost[];
  const [mediaUrls, avatarUrls] = await Promise.all([
    signedUrls("family-media", rows.flatMap((r) => (r.media ?? []).flatMap((m) => [m.thumb_path ?? m.path, m.path]))),
    signedUrls("avatars", rows.map((r) => r.author_avatar)),
  ]);
  const posts: FeedPost[] = rows.map((r) => ({
    id: r.id, authorName: r.author_name, authorMemberId: r.author_member_id,
    authorAvatarUrl: r.author_avatar ? (avatarUrls[r.author_avatar] ?? null) : null,
    body: r.body, visibility: r.visibility === "branch" ? "branch" : "family", pinned: r.pinned, hidden: r.hidden,
    hideReason: r.hide_reason, createdAt: r.created_at, editedAt: r.edited_at, commentCount: r.comment_count,
    reactions: r.reactions ?? {}, myReaction: r.my_reaction,
    media: (r.media ?? []).flatMap((m): FeedMedia[] => {
      const full = mediaUrls[m.path], thumb = mediaUrls[m.thumb_path ?? m.path] ?? full;
      return full && thumb ? [{ id: m.id, thumbUrl: thumb, fullUrl: full }] : [];
    }),
    canModerate: r.can_moderate, isMine: r.is_mine,
  }));
  const last = rows[rows.length - 1];
  const next = !opts.pinned && rows.length >= FEED_PAGE_SIZE && last ? { before: last.created_at, beforeId: last.id } : null;
  return { posts, next };
}

type RawComment = {
  id: string; author_name: string; author_member_id: string | null; author_avatar: string | null; body: string;
  created_at: string; edited_at: string | null; can_delete: boolean; is_mine: boolean;
};
export async function loadComments(postId: string): Promise<FeedComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_comments", { p_post: postId, p_after: null, p_limit: 100 });
  if (error) throw new Error("post_comments failed");
  const rows = (data ?? []) as RawComment[];
  const avatarUrls = await signedUrls("avatars", rows.map((r) => r.author_avatar));
  return rows.map((r) => ({
    id: r.id, authorName: r.author_name, authorMemberId: r.author_member_id,
    authorAvatarUrl: r.author_avatar ? (avatarUrls[r.author_avatar] ?? null) : null,
    body: r.body, createdAt: r.created_at, editedAt: r.edited_at, canDelete: r.can_delete, isMine: r.is_mine,
  }));
}
