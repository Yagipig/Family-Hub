"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Lightbox } from "@/components/Lightbox";
import { Alert, buttonClass, buttonGhostClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import {
  addCommentAction, deleteCommentAction, deletePostAction, hidePostAction, loadCommentsAction, loadMoreAction,
  pinPostAction, reportAction, setReactionAction, updatePostAction, type FeedResult,
} from "./actions";
import { REACTIONS, type FeedComment, type FeedCursor, type FeedPost } from "./feed-types";

const smallBtn = "inline-flex min-h-12 items-center justify-center rounded-xl border border-wine px-4 text-base font-semibold text-wine hover:bg-champagne-soft disabled:opacity-60";
const textInput = "block w-full rounded-xl border border-ink-soft/40 bg-white px-4 py-3 text-base text-ink";

export function Feed({
  pinned, initial, initialNext, timezone, canInteract,
}: { pinned: FeedPost[]; initial: FeedPost[]; initialNext: FeedCursor | null; timezone: string; canInteract: boolean }) {
  const [posts, setPosts] = useState<FeedPost[]>(initial);
  const [pins, setPins] = useState<FeedPost[]>(pinned);
  const [next, setNext] = useState<FeedCursor | null>(initialNext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function more() {
    if (!next || loading) return;
    setLoading(true); setError(null);
    const r = await loadMoreAction(next);
    setLoading(false);
    if (r.error) { setError(r.error); return; }
    const seen = new Set([...posts, ...pins].map((p) => p.id));
    setPosts((cur) => [...cur, ...r.posts.filter((p) => !seen.has(p.id))]);
    setNext(r.next);
  }

  const update = (id: string, patch: Partial<FeedPost>) => {
    const f = (list: FeedPost[]) => list.map((p) => (p.id === id ? { ...p, ...patch } : p));
    setPosts(f); setPins(f);
  };
  const remove = (id: string) => { setPosts((c) => c.filter((p) => p.id !== id)); setPins((c) => c.filter((p) => p.id !== id)); };

  return (
    <div className="space-y-5">
      {pins.length > 0 && (
        <section aria-label="Bài được ghim" className="space-y-4">
          {pins.map((p) => <PostCard key={p.id} post={p} timezone={timezone} canInteract={canInteract} onUpdate={update} onRemove={remove} />)}
        </section>
      )}
      {posts.length === 0 && pins.length === 0 && (
        <p className="rounded-2xl border border-champagne/60 bg-ivory p-6 text-lg">Chưa có bài viết nào. Hãy là người đầu tiên chia sẻ với gia đình.</p>
      )}
      <section aria-label="Bài viết mới" className="space-y-4">
        {posts.map((p) => <PostCard key={p.id} post={p} timezone={timezone} canInteract={canInteract} onUpdate={update} onRemove={remove} />)}
      </section>
      {error && <Alert kind="error">{error}</Alert>}
      {next && (
        <div className="text-center">
          <button type="button" onClick={more} disabled={loading} className={buttonClass}>{loading ? "Đang tải…" : "Xem thêm bài cũ hơn"}</button>
        </div>
      )}
    </div>
  );
}

function PostCard({
  post, timezone, canInteract, onUpdate, onRemove,
}: { post: FeedPost; timezone: string; canInteract: boolean; onUpdate: (id: string, patch: Partial<FeedPost>) => void; onRemove: (id: string) => void }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [showComments, setShowComments] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<FeedResult>, onOk?: (r: FeedResult) => void) => {
    setBusy(true); setMsg(null);
    const r = await fn();
    setBusy(false);
    if (r.error) setMsg({ kind: "error", text: r.error });
    else { setMsg({ kind: "ok", text: r.ok ?? "Xong." }); onOk?.(r); }
  };

  async function react(kind: string) {
    const was = post.myReaction;
    const counts = { ...post.reactions };
    if (was) counts[was] = Math.max(0, (counts[was] ?? 1) - 1);
    const target = was === kind ? null : kind;
    if (target) counts[target] = (counts[target] ?? 0) + 1;
    onUpdate(post.id, { reactions: counts, myReaction: target });
    const r = await setReactionAction("post", post.id, target);
    if (r.error) { onUpdate(post.id, { reactions: post.reactions, myReaction: was }); setMsg({ kind: "error", text: r.error }); }
  }

  const totalReactions = Object.values(post.reactions).reduce((a, b) => a + b, 0);
  const lbItems = post.media.map((m) => ({ id: m.id, src: m.fullUrl }));

  return (
    <article id={`bai-${post.id}`} className={`space-y-4 rounded-2xl border bg-ivory p-5 shadow-sm ${post.pinned ? "border-wine" : "border-champagne/60"}`}>
      <header className="flex items-start gap-3">
        <Avatar src={post.authorAvatarUrl} name={post.authorName} size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">
            {post.authorMemberId ? <Link href={`/thanh-vien/${post.authorMemberId}`} className="hover:underline">{post.authorName}</Link> : post.authorName}
          </p>
          <p className="text-base text-ink-soft">
            {formatDateTime(post.createdAt, timezone)}{post.editedAt ? " · đã sửa" : ""}
            {post.visibility === "branch" ? " · Chỉ trong nhánh" : ""}
          </p>
          <p className="flex flex-wrap gap-2 text-sm font-semibold">
            {post.pinned && <span className="rounded-full bg-champagne-soft px-3 py-1 text-wine">Đã ghim</span>}
            {post.hidden && <span className="rounded-full bg-red-50 px-3 py-1 text-danger">Đang bị ẩn (chỉ bạn và quản trị viên thấy)</span>}
          </p>
        </div>
      </header>

      {post.hidden && post.hideReason && <p className="text-base text-danger">Lý do ẩn: {post.hideReason}</p>}

      {editing ? (
        <div className="space-y-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={5000} rows={4} className={`${textInput} text-lg`} aria-label="Sửa nội dung bài viết" />
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonClass} disabled={busy}
              onClick={() => run(() => updatePostAction(post.id, draft), () => { onUpdate(post.id, { body: draft.trim(), editedAt: new Date().toISOString() }); setEditing(false); })}>Lưu</button>
            <button type="button" className={buttonGhostClass} onClick={() => { setEditing(false); setDraft(post.body); }}>Hủy</button>
          </div>
        </div>
      ) : (
        post.body && <p className="whitespace-pre-wrap break-words text-lg leading-relaxed">{post.body}</p>
      )}

      {post.media.length > 0 && (
        <ul className={`grid gap-2 ${post.media.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}>
          {post.media.map((m, i) => (
            <li key={m.id}>
              <button type="button" onClick={() => setLightbox(i)} aria-label={`Xem ảnh ${i + 1} trên ${post.media.length}`}
                className="block w-full overflow-hidden rounded-xl bg-champagne-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.thumbUrl} alt={`Ảnh ${i + 1} trong bài của ${post.authorName}`} loading="lazy" decoding="async"
                  className={`w-full object-cover ${post.media.length === 1 ? "max-h-[28rem]" : "aspect-square"}`} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Lightbox items={lbItems} index={lightbox} onClose={() => setLightbox(null)} onChange={setLightbox} />

      <div>
        <div role="group" aria-label="Bày tỏ cảm xúc" className="flex flex-wrap gap-2">
          {REACTIONS.map((r) => {
            const n = post.reactions[r.kind] ?? 0;
            const on = post.myReaction === r.kind;
            return (
              <button key={r.kind} type="button" disabled={!canInteract} onClick={() => react(r.kind)} aria-pressed={on} aria-label={`${r.label}${n ? `, ${n} người` : ""}`}
                className={`inline-flex min-h-12 min-w-12 items-center justify-center gap-1 rounded-full border px-3 text-lg ${on ? "border-wine bg-champagne-soft font-bold" : "border-champagne"}`}>
                <span aria-hidden="true">{r.icon}</span>{n > 0 && <span className="text-base">{n}</span>}
              </button>
            );
          })}
        </div>
        {totalReactions > 0 && <p className="mt-1 text-sm text-ink-soft">{totalReactions} lượt cảm xúc</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={smallBtn} aria-expanded={showComments} onClick={() => setShowComments((v) => !v)}>
          {showComments ? "Ẩn bình luận" : `Bình luận${post.commentCount > 0 ? ` (${post.commentCount})` : ""}`}
        </button>
        {post.isMine && !post.hidden && !editing && <button type="button" className={smallBtn} onClick={() => setEditing(true)}>Sửa</button>}
        {(post.isMine || post.canModerate) && (
          <button type="button" className={smallBtn} disabled={busy}
            onClick={() => {
              if (!window.confirm("Xóa bài viết này? Ảnh và bình luận đi kèm cũng bị xóa.")) return;
              run(() => deletePostAction(post.id), () => { onRemove(post.id); router.refresh(); });
            }}>Xóa</button>
        )}
        {!post.isMine && canInteract && <button type="button" className={smallBtn} onClick={() => setReporting((v) => !v)}>Báo cáo</button>}
        {post.canModerate && (
          <>
            {post.hidden
              ? <button type="button" className={smallBtn} disabled={busy}
                  onClick={() => run(() => hidePostAction(post.id, false, ""), () => { onUpdate(post.id, { hidden: false, hideReason: null }); router.refresh(); })}>Hiện lại</button>
              : <button type="button" className={smallBtn} onClick={() => setHiding((v) => !v)}>Ẩn bài</button>}
            {!post.hidden && (
              <button type="button" className={smallBtn} disabled={busy}
                onClick={() => run(() => pinPostAction(post.id, !post.pinned), () => router.refresh())}>{post.pinned ? "Bỏ ghim" : "Ghim"}</button>
            )}
          </>
        )}
      </div>

      {reporting && (
        <ReasonForm label="Lý do báo cáo" submit="Gửi báo cáo" onCancel={() => setReporting(false)}
          onSubmit={(reasonText) => run(() => reportAction(post.id, null, reasonText), () => setReporting(false))} />
      )}
      {hiding && (
        <ReasonForm label="Lý do ẩn (người đăng sẽ thấy)" submit="Ẩn bài" optional onCancel={() => setHiding(false)}
          onSubmit={(reasonText) => run(() => hidePostAction(post.id, true, reasonText), () => { onUpdate(post.id, { hidden: true, hideReason: reasonText || null, pinned: false }); setHiding(false); router.refresh(); })} />
      )}
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      {showComments && <Comments post={post} timezone={timezone} canInteract={canInteract} onCount={(n) => onUpdate(post.id, { commentCount: n })} />}
    </article>
  );
}

function ReasonForm({
  label, submit, optional, onSubmit, onCancel,
}: { label: string; submit: string; optional?: boolean; onSubmit: (reason: string) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  return (
    <form className="space-y-2 rounded-xl border border-champagne/60 bg-white p-4"
      onSubmit={(e) => { e.preventDefault(); if (!optional && text.trim() === "") return; onSubmit(text.trim()); }}>
      <label className="block text-base font-semibold">{label}
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={2} required={!optional} className={`${textInput} mt-1`} />
      </label>
      <div className="flex flex-wrap gap-3">
        <button className={buttonClass}>{submit}</button>
        <button type="button" className={buttonGhostClass} onClick={onCancel}>Hủy</button>
      </div>
    </form>
  );
}

function Comments({ post, timezone, canInteract, onCount }: { post: FeedPost; timezone: string; canInteract: boolean; onCount: (n: number) => void }) {
  const [list, setList] = useState<FeedComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const reload = async () => {
    const r = await loadCommentsAction(post.id);
    if (r.error) setError(r.error); else { setError(null); setList(r.comments); onCount(r.comments.length); }
  };
  useEffect(() => {
    let alive = true;
    loadCommentsAction(post.id).then((r) => {
      if (!alive) return;
      if (r.error) setError(r.error); else { setList(r.comments); onCount(r.comments.length); }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || text.trim() === "") return;
    setBusy(true);
    const r = await addCommentAction(post.id, text);
    if (r.error) setError(r.error); else { setText(""); await reload(); }
    setBusy(false);
  }

  return (
    <div className="space-y-3 border-t border-champagne/60 pt-4">
      {error && <Alert kind="error">{error}</Alert>}
      {note && <Alert kind="ok">{note}</Alert>}
      {list === null && !error && <p className="text-base text-ink-soft">Đang tải bình luận…</p>}
      <ul className="space-y-3">
        {(list ?? []).map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar src={c.authorAvatarUrl} name={c.authorName} size={44} />
            <div className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3">
              <p className="text-base font-bold">{c.authorName} <span className="font-normal text-ink-soft">· {formatDateTime(c.createdAt, timezone)}</span></p>
              <p className="whitespace-pre-wrap break-words text-base">{c.body}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {c.canDelete && (
                  <button type="button" className="min-h-12 px-2 text-base font-semibold text-wine underline"
                    onClick={async () => {
                      if (!window.confirm("Xóa bình luận này?")) return;
                      const r = await deleteCommentAction(c.id);
                      if (r.error) setError(r.error); else await reload();
                    }}>Xóa</button>
                )}
                {!c.isMine && canInteract && <button type="button" className="min-h-12 px-2 text-base font-semibold text-wine underline" onClick={() => setReportId(reportId === c.id ? null : c.id)}>Báo cáo</button>}
              </div>
              {reportId === c.id && (
                <ReasonForm label="Lý do báo cáo bình luận" submit="Gửi báo cáo" onCancel={() => setReportId(null)}
                  onSubmit={async (reasonText) => {
                    const r = await reportAction(post.id, c.id, reasonText);
                    if (r.error) setError(r.error); else { setNote(r.ok ?? "Đã gửi."); setReportId(null); }
                  }} />
              )}
            </div>
          </li>
        ))}
      </ul>
      {canInteract ? <form onSubmit={send} className="flex flex-wrap items-end gap-3">
        <label className="min-w-[14rem] flex-1 text-base font-semibold">Viết bình luận
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={2} className={`${textInput} mt-1`} />
        </label>
        <button className={buttonClass} disabled={busy || text.trim() === ""}>Gửi</button>
      </form> : <p className="text-base text-ink-soft">Tài khoản khách chỉ được xem, không bình luận.</p>}
    </div>
  );
}
