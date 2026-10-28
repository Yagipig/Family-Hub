"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/format";
import { mediaErrorMessage } from "@/lib/media-core";
import { loadComments, loadFeed } from "./feed-data";
import type { FeedComment, FeedCursor, FeedPost } from "./feed-types";

export type FeedResult = { ok?: string; error?: string; id?: string };
const uuid = z.uuid();
const reactionKind = z.enum(["heart", "like", "haha", "wow", "sad", "pray"]);
const bad = (): FeedResult => ({ error: "Thông tin chưa hợp lệ." });
function fail(e: { code?: string; message?: string }): FeedResult {
  if (e.code === "P0001" && /too many (posts|comments)/.test(e.message ?? "")) return { error: "Bạn thao tác hơi nhanh. Vui lòng thử lại sau ít phút." };
  if (e.code === "22023" && /empty post/.test(e.message ?? "")) return { error: "Bài viết cần có chữ hoặc ảnh." };
  if (e.code === "22023" && /too many images/.test(e.message ?? "")) return { error: "Mỗi bài tối đa 10 ảnh." };
  if (e.code === "22023" && /body too long/.test(e.message ?? "")) return { error: "Nội dung quá dài (tối đa 5000 ký tự)." };
  return { error: mediaErrorMessage(e) ?? friendlyError(e) };
}
const refresh = () => revalidatePath("/bang-tin");

export async function loadMoreAction(cursor: FeedCursor): Promise<{ posts: FeedPost[]; next: FeedCursor | null; error?: string }> {
  const session = await requireSession();
  const c = z.object({ before: z.iso.datetime({ offset: true }), beforeId: uuid }).safeParse(cursor);
  if (!c.success) return { posts: [], next: null, error: "Thông tin chưa hợp lệ." };
  try {
    return await loadFeed(session.familyId, { cursor: c.data });
  } catch {
    return { posts: [], next: null, error: "Không tải được thêm bài viết." };
  }
}

export async function loadCommentsAction(postId: string): Promise<{ comments: FeedComment[]; error?: string }> {
  await requireSession();
  if (!uuid.safeParse(postId).success) return { comments: [], error: "Thông tin chưa hợp lệ." };
  try {
    return { comments: await loadComments(postId) };
  } catch {
    return { comments: [], error: "Không tải được bình luận." };
  }
}

export async function createPostAction(body: string, visibility: string, mediaIds: string[]): Promise<FeedResult> {
  const session = await requireSession();
  const v = z.enum(["family", "branch"]).safeParse(visibility);
  const ids = z.array(uuid).max(10).safeParse(mediaIds);
  if (!v.success || !ids.success || body.length > 5000) return bad();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_post", {
    p_family: session.familyId, p_body: body, p_visibility: v.data,
    p_branch: v.data === "branch" ? session.branchId : null, p_media: ids.data,
  });
  if (error) return fail(error);
  refresh();
  return { ok: "Đã đăng bài.", id: data as string };
}

export async function updatePostAction(postId: string, body: string): Promise<FeedResult> {
  await requireSession();
  if (!uuid.safeParse(postId).success || body.length > 5000) return bad();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_post", { p_post: postId, p_body: body });
  if (error) return fail(error);
  refresh();
  return { ok: "Đã sửa bài viết." };
}

export async function deletePostAction(postId: string): Promise<FeedResult> {
  await requireSession();
  if (!uuid.safeParse(postId).success) return bad();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_post", { p_post: postId });
  if (error) return fail(error);
  refresh();
  return { ok: "Đã xóa bài viết." };
}

export async function hidePostAction(postId: string, hide: boolean, reason: string): Promise<FeedResult> {
  await requireSession();
  if (!uuid.safeParse(postId).success) return bad();
  const supabase = await createClient();
  const { error } = hide
    ? await supabase.rpc("hide_post", { p_post: postId, p_reason: reason.trim().slice(0, 500) || null })
    : await supabase.rpc("unhide_post", { p_post: postId });
  if (error) return fail(error);
  refresh(); revalidatePath("/admin/kiem-duyet");
  return { ok: hide ? "Đã ẩn bài viết." : "Đã hiện lại bài viết." };
}

export async function pinPostAction(postId: string, pinned: boolean): Promise<FeedResult> {
  await requireSession();
  if (!uuid.safeParse(postId).success) return bad();
  const supabase = await createClient();
  const { error } = await supabase.rpc("pin_post", { p_post: postId, p_pinned: pinned });
  if (error) return fail(error);
  refresh();
  return { ok: pinned ? "Đã ghim bài viết." : "Đã bỏ ghim." };
}

export async function addCommentAction(postId: string, body: string): Promise<FeedResult> {
  await requireSession();
  const text = body.trim();
  if (!uuid.safeParse(postId).success || text.length < 1 || text.length > 2000) return { error: "Bình luận cần từ 1 đến 2000 ký tự." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_comment", { p_post: postId, p_body: text });
  if (error) return fail(error);
  return { ok: "Đã gửi bình luận.", id: data as string };
}

export async function deleteCommentAction(commentId: string): Promise<FeedResult> {
  await requireSession();
  if (!uuid.safeParse(commentId).success) return bad();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_comment", { p_comment: commentId });
  if (error) return fail(error);
  return { ok: "Đã xóa bình luận." };
}

/** kind = null: bỏ cảm xúc. */
export async function setReactionAction(target: "post" | "comment", id: string, kind: string | null): Promise<FeedResult> {
  await requireSession();
  const k = kind === null ? { success: true as const, data: null } : reactionKind.safeParse(kind);
  if (!uuid.safeParse(id).success || !k.success || (target !== "post" && target !== "comment")) return bad();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_reaction", { p_target_type: target, p_target: id, p_kind: k.data });
  if (error) return fail(error);
  return { ok: "Đã ghi nhận." };
}

export async function reportAction(postId: string, commentId: string | null, reason: string): Promise<FeedResult> {
  await requireSession();
  const r = reason.trim();
  if (!uuid.safeParse(postId).success || (commentId !== null && !uuid.safeParse(commentId).success) || r.length < 1 || r.length > 500) {
    return { error: "Vui lòng nhập lý do báo cáo (tối đa 500 ký tự)." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_content", { p_post: postId, p_comment: commentId, p_reason: r });
  if (error) return fail(error);
  revalidatePath("/admin/kiem-duyet");
  return { ok: "Đã gửi báo cáo cho quản trị viên. Cảm ơn bạn." };
}

export async function setNotificationsAction(on: boolean): Promise<FeedResult> {
  const session = await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_post_notifications", { p_family: session.familyId, p_comments: on === true });
  if (error) return fail(error);
  refresh();
  return { ok: on ? "Đã bật thông báo bình luận." : "Đã tắt thông báo bình luận." };
}
