"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, buttonClass, buttonGhostClass } from "@/components/ui";
import { Lightbox } from "@/components/Lightbox";
import { UploadProgress } from "@/components/UploadProgress";
import { useUploader } from "@/components/useUploader";
import {
  createAlbumAction, deleteAlbumAction, ensureDefaultAlbumAction, removeItemAction, tagPersonAction, updateAlbumAction, updateItemAction,
  type AlbumActionResult,
} from "./actions";

export type AlbumInfo = { id: string; title: string; description: string | null; visibility: string; is_default: boolean; item_count: number };
export type PhotoInfo = {
  id: string; mediaId: string; caption: string | null; thumbUrl: string; fullUrl: string; canManage: boolean; people: string[];
};

const VIS: Record<string, string> = { family: "Cả gia đình", branch: "Cùng nhánh họ", owner: "Chỉ mình chủ album" };
const input = "mt-1 block w-full min-h-11 rounded-xl border border-ink-soft/40 bg-white px-4 py-2 text-[15px] text-ink md:min-h-12 md:text-base";

export function AlbumView({
  memberId, albums, currentId, photos, names, roster, canAdd, canEditAlbum, canDeleteAlbum, canTag, total,
}: {
  memberId: string; albums: AlbumInfo[]; currentId: string | null; photos: PhotoInfo[]; names: Record<string, string>;
  roster: { id: string; name: string }[]; canAdd: boolean; canEditAlbum: boolean; canDeleteAlbum: boolean; canTag: boolean; total: number;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploader = useUploader();
  const [open, setOpen] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [panel, setPanel] = useState<"none" | "new" | "edit">("none");
  const [caption, setCaption] = useState("");
  const [pending, start] = useTransition();
  const current = albums.find((a) => a.id === currentId) ?? null;

  const done = (r: AlbumActionResult, after?: () => void) => {
    if (r.error) { setMsg({ kind: "error", text: r.error }); return; }
    setMsg({ kind: "ok", text: r.ok ?? "Xong." });
    after?.();
    start(() => router.refresh());
  };

  async function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []).slice(0, 30);
    if (fileInput.current) fileInput.current.value = "";
    if (files.length === 0) return;
    setMsg(null);
    let albumId = currentId;
    if (!albumId) {
      const r = await ensureDefaultAlbumAction(memberId);
      if (r.error || !r.id) { setMsg({ kind: "error", text: r.error ?? "Không tạo được album." }); return; }
      albumId = r.id;
    }
    const ok = await uploader.run(files, { kind: "album", memberId, albumId });
    const failed = files.length - ok.length;
    setMsg(failed > 0
      ? { kind: ok.length > 0 ? "ok" : "error", text: `Đã tải ${ok.length} ảnh, ${failed} ảnh chưa tải được (xem chi tiết bên dưới).` }
      : { kind: "ok", text: `Đã tải lên ${ok.length} ảnh.` });
    if (ok.length > 0) {
      if (albumId !== currentId) router.replace(`/album/${memberId}?album=${albumId}`);
      start(() => router.refresh());
    }
    if (failed === 0) setTimeout(() => uploader.clear(), 2500);
  }

  const lightItems = photos.map((p) => ({ id: p.id, src: p.fullUrl, caption: p.caption }));
  const cur = open !== null ? photos[open] : null;

  return (
    <div className="space-y-6">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      {albums.length > 0 && (
        <nav aria-label="Các album" className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {albums.map((a) => (
            <Link key={a.id} href={`/album/${memberId}?album=${a.id}`} aria-current={a.id === currentId ? "page" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center rounded-xl border px-3 text-sm font-semibold whitespace-nowrap md:min-h-12 md:px-4 md:text-base ${a.id === currentId ? "border-wine bg-wine text-white" : "border-wine text-wine hover:bg-champagne-soft"}`}>
              {a.title} ({a.item_count})
            </Link>
          ))}
        </nav>
      )}

      {current && (
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">{current.title}</h2>
          {current.description && <p className="text-lg text-ink-soft">{current.description}</p>}
          <p className="text-base text-ink-soft">Ai xem được: {VIS[current.visibility] ?? current.visibility} · {total} ảnh</p>
        </div>
      )}

      {canAdd && (
        <div className="space-y-2.5 rounded-2xl border border-champagne/60 bg-ivory p-3 md:space-y-3 md:p-4">
          <div className="flex flex-wrap gap-2">
            <label className={`${buttonClass} cursor-pointer text-sm md:text-base ${uploader.busy ? "pointer-events-none opacity-60" : ""}`}>
              {uploader.busy ? "Đang tải…" : "Thêm ảnh"}
              <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only"
                disabled={uploader.busy} onChange={(e) => onFiles(e.target.files)} />
            </label>
            <button type="button" className={buttonGhostClass + " text-sm md:text-base"} onClick={() => setPanel(panel === "new" ? "none" : "new")}>Tạo album</button>
            {current && canEditAlbum && <button type="button" className={buttonGhostClass + " text-sm md:text-base"} onClick={() => setPanel(panel === "edit" ? "none" : "edit")}>Sửa</button>}
            {current && canDeleteAlbum && (
              <button type="button" disabled={pending} className={buttonGhostClass + " text-sm md:text-base"}
                onClick={() => {
                  if (!window.confirm(`Xóa album "${current.title}" cùng tất cả ảnh?`)) return;
                  deleteAlbumAction(memberId, current.id).then((r) => done(r, () => router.replace(`/album/${memberId}`)));
                }}>Xóa</button>
            )}
          </div>
          <p className="text-xs text-ink-soft md:text-sm">Chọn nhiều ảnh (tối đa 30). JPG/PNG/WebP.</p>
          <UploadProgress items={uploader.items} />
          {panel !== "none" && (
            <AlbumForm
              key={panel + (current?.id ?? "")}
              initial={panel === "edit" && current ? current : null}
              onCancel={() => setPanel("none")}
              onSubmit={async (t, d, v) => {
                const r = panel === "edit" && current
                  ? await updateAlbumAction(memberId, current.id, t, d, v)
                  : await createAlbumAction(memberId, t, d, v);
                done(r, () => { setPanel("none"); if (panel === "new" && r.id) router.replace(`/album/${memberId}?album=${r.id}`); });
              }}
            />
          )}
        </div>
      )}

      {photos.length === 0 ? (
        <p className="rounded-2xl border border-champagne/60 bg-ivory p-4 text-base md:p-6 md:text-lg">
          {canAdd ? "Album chưa có ảnh. Bấm “Thêm ảnh”." : "Chưa có ảnh nào bạn được xem."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="Ảnh trong album">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button type="button" onClick={() => { setOpen(i); setCaption(p.caption ?? ""); }}
                aria-label={p.caption ? `Xem ảnh: ${p.caption}` : `Xem ảnh số ${i + 1}`}
                className="block aspect-square w-full overflow-hidden rounded-xl bg-champagne-soft focus-visible:outline-2 focus-visible:outline-wine">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbUrl} alt={p.caption ?? `Ảnh ${i + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Lightbox items={lightItems} index={open} onClose={() => setOpen(null)} onChange={(i) => { setOpen(i); setCaption(photos[i]?.caption ?? ""); }}>
        {cur && (
          <div className="mt-2 space-y-2 md:mt-3 md:space-y-3">
            {cur.people.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5 text-sm md:gap-2 md:text-base">
                <span className="font-semibold">Trong ảnh:</span>
                {cur.people.map((id) => (
                  <span key={id} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-champagne-soft px-2.5 text-sm md:min-h-10 md:gap-2 md:px-3 md:text-base">
                    {names[id] ?? "Thành viên"}
                    {canTag && cur.canManage && (
                      <button type="button" aria-label={`Bỏ thẻ`} className="min-h-9 min-w-9 font-bold text-wine md:min-h-10 md:min-w-10"
                        onClick={() => tagPersonAction(memberId, cur.mediaId, id, false).then((r) => done(r))}>✕</button>
                    )}
                  </span>
                ))}
              </p>
            )}
            {canTag && cur.canManage && roster.length > 0 && (
              <label className="block text-sm font-semibold md:text-base">Gắn thẻ người
                <select className={input} value="" onChange={(e) => { if (e.target.value) tagPersonAction(memberId, cur.mediaId, e.target.value, true).then((r) => done(r)); }}>
                  <option value="">Chọn người…</option>
                  {roster.filter((m) => !cur.people.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
            )}
            {cur.canManage && (
              <div className="space-y-1.5 md:space-y-2">
                <label className="block text-sm font-semibold md:text-base">Chú thích
                  <input className={input} value={caption} maxLength={300} onChange={(e) => setCaption(e.target.value)} placeholder="Ví dụ: Tết 2024" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={buttonClass + " text-sm md:text-base"} disabled={pending}
                    onClick={() => updateItemAction(memberId, cur.id, caption).then((r) => done(r))}>Lưu</button>
                  <button type="button" className={buttonGhostClass + " text-sm md:text-base"} disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Xóa ảnh?")) return;
                      removeItemAction(memberId, cur.id).then((r) => done(r, () => setOpen(null)));
                    }}>Xóa</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Lightbox>
    </div>
  );
}

function AlbumForm({
  initial, onSubmit, onCancel,
}: { initial: AlbumInfo | null; onSubmit: (title: string, desc: string, vis: string) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [vis, setVis] = useState(initial?.visibility ?? "family");
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-3 rounded-xl border border-champagne/60 bg-white p-4"
      onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(title, desc, vis); } finally { setBusy(false); } }}>
      <label className="block text-base font-semibold">Tên album
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
      </label>
      <label className="block text-base font-semibold">Mô tả (không bắt buộc)
        <textarea className={input} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} rows={2} />
      </label>
      <label className="block text-base font-semibold">Ai xem được
        <select className={input} value={vis} onChange={(e) => setVis(e.target.value)}>
          <option value="family">Cả gia đình</option>
          <option value="branch">Cùng nhánh họ</option>
          <option value="owner">Chỉ mình chủ album</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-3">
        <button className={buttonClass} disabled={busy}>{initial ? "Lưu album" : "Tạo album"}</button>
        <button type="button" className={buttonGhostClass} onClick={onCancel}>Hủy</button>
      </div>
    </form>
  );
}
