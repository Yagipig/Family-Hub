"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, buttonClass, buttonGhostClass } from "@/components/ui";
import { UploadError, prepareAndUpload } from "@/lib/image-client";
import { createPostAction } from "./actions";

type Pic = { key: string; name: string; preview: string; progress: number; status: "uploading" | "done" | "error"; mediaId?: string; error?: string };
const MAX_PICS = 10;

export function Composer({ hasBranch }: { hasBranch: boolean }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"family" | "branch">("family");
  const [pics, setPics] = useState<Pic[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [posting, setPosting] = useState(false);
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const uploading = pics.some((p) => p.status === "uploading");
  const patch = (key: string, p: Partial<Pic>) => setPics((cur) => cur.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function onFiles(list: FileList | null) {
    const room = MAX_PICS - pics.length;
    const files = Array.from(list ?? []).slice(0, Math.max(0, room));
    if (fileInput.current) fileInput.current.value = "";
    if ((list?.length ?? 0) > room) setMsg({ kind: "error", text: `Mỗi bài tối đa ${MAX_PICS} ảnh.` });
    else setMsg(null);
    const added: Pic[] = files.map((f, i) => {
      const preview = URL.createObjectURL(f);
      previews.current.push(preview);
      return { key: `${Date.now()}-${i}`, name: f.name, preview, progress: 0, status: "uploading" };
    });
    setPics((cur) => [...cur, ...added]);
    let next = 0;
    const worker = async () => {
      for (;;) {
        const i = next++;
        if (i >= files.length) return;
        const key = added[i].key;
        try {
          const r = await prepareAndUpload(files[i], { kind: "post" }, (p) => patch(key, { progress: p }));
          patch(key, { status: "done", progress: 1, mediaId: r.mediaId });
        } catch (e) {
          patch(key, { status: "error", error: e instanceof UploadError ? e.message : "Không tải được ảnh này." });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, files.length) }, worker));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (posting || uploading) return;
    const ids = pics.flatMap((p) => (p.status === "done" && p.mediaId ? [p.mediaId] : []));
    if (body.trim() === "" && ids.length === 0) { setMsg({ kind: "error", text: "Bài viết cần có chữ hoặc ảnh." }); return; }
    setPosting(true); setMsg(null);
    const r = await createPostAction(body, visibility, ids);
    setPosting(false);
    if (r.error) { setMsg({ kind: "error", text: r.error }); return; }
    setBody(""); setPics([]); setMsg({ kind: "ok", text: r.ok ?? "Đã đăng bài." });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-champagne/60 bg-ivory p-4 shadow-sm md:p-5" aria-label="Viết bài mới">
      <label className="block text-base font-semibold md:text-lg">Chia sẻ với gia đình
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={3}
          placeholder="Bạn muốn chia sẻ điều gì hôm nay?"
          className="mt-1.5 block w-full rounded-xl border border-ink-soft/40 bg-white px-4 py-2.5 text-[15px] text-ink md:py-3 md:text-base" />
      </label>

      {pics.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {pics.map((p) => (
            <li key={p.key} className="relative overflow-hidden rounded-xl border border-champagne/60 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={`Ảnh xem trước: ${p.name}`} className="aspect-square w-full object-cover" />
              <div className="p-1.5 text-xs md:p-2 md:text-sm">
                {p.status === "uploading" && (
                  <div role="progressbar" aria-label={`Tiến độ ${p.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.progress * 100)}
                    className="h-2 overflow-hidden rounded-full bg-champagne-soft md:h-3">
                    <div className="h-full bg-wine transition-all" style={{ width: `${Math.round(p.progress * 100)}%` }} />
                  </div>
                )}
                {p.status === "done" && <span className="font-semibold text-ok">Đã tải</span>}
                {p.status === "error" && <span className="font-semibold text-danger">{p.error}</span>}
              </div>
              <button type="button" onClick={() => setPics((cur) => cur.filter((x) => x.key !== p.key))}
                aria-label={`Bỏ ảnh ${p.name}`}
                className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-lg text-white md:h-10 md:w-10">✕</button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className={`${buttonGhostClass} cursor-pointer text-sm md:text-base ${pics.length >= MAX_PICS ? "pointer-events-none opacity-60" : ""}`}>
          Thêm ảnh
          <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only"
            disabled={pics.length >= MAX_PICS} onChange={(e) => onFiles(e.target.files)} />
        </label>
        {hasBranch && (
          <label className="text-sm font-semibold md:text-base">Ai xem
            <select value={visibility} onChange={(e) => setVisibility(e.target.value === "branch" ? "branch" : "family")}
              className="ml-1.5 min-h-10 rounded-xl border border-ink-soft/40 bg-white px-2 text-sm md:min-h-12 md:px-3 md:text-base">
              <option value="family">Cả gia đình</option>
              <option value="branch">Nhánh tôi</option>
            </select>
          </label>
        )}
        <button className={buttonClass + " text-sm md:text-base"} disabled={posting || uploading}>{posting ? "Đang đăng…" : uploading ? "Đang tải…" : "Đăng"}</button>
      </div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
    </form>
  );
}
