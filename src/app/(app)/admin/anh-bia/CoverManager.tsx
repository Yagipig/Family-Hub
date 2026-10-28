"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, buttonClass, buttonGhostClass } from "@/components/ui";
import { UploadError, prepareAndUpload } from "@/lib/image-client";
import { setCoverAction, setQuotaAction } from "./actions";

export function CoverManager({ currentUrl, quotaMb, isSuperAdmin }: { currentUrl: string | null; quotaMb: number | null; isSuperAdmin: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [mb, setMb] = useState(quotaMb ?? 800);
  const [pending, start] = useTransition();

  async function onPick(file: File | undefined) {
    if (!file) return;
    setMsg(null); setMediaId(null); setProgress(0);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    try {
      const up = await prepareAndUpload(file, { kind: "cover" }, setProgress);
      setMediaId(up.mediaId);
    } catch (e) {
      setPreview(null);
      setMsg({ kind: "error", text: e instanceof UploadError ? e.message : "Không tải được ảnh. Vui lòng thử lại." });
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  async function apply(id: string | null) {
    const r = await setCoverAction(id);
    if (r.error) { setMsg({ kind: "error", text: r.error }); return; }
    setMsg({ kind: "ok", text: r.ok ?? "Xong." });
    setMediaId(null); setPreview(null);
    start(() => router.refresh());
  }

  const shown = preview ?? currentUrl;
  return (
    <div className="space-y-4">
      <div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl bg-wine">
        {shown
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={shown} alt={preview ? "Xem trước ảnh bìa mới" : "Ảnh bìa hiện tại"} className="h-full w-full object-cover" />
          : <p className="flex h-full items-center justify-center px-4 text-center text-lg text-white">Chưa có ảnh bìa (đang dùng màu đỏ rượu)</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <label className={`${buttonGhostClass} cursor-pointer ${progress !== null ? "pointer-events-none opacity-60" : ""}`}>
          {progress !== null ? "Đang tải…" : "Chọn ảnh bìa mới"}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only"
            disabled={progress !== null} onChange={(e) => onPick(e.target.files?.[0])} />
        </label>
        {mediaId && <button type="button" className={buttonClass} disabled={pending} onClick={() => apply(mediaId)}>Dùng ảnh này làm ảnh bìa</button>}
        {mediaId && <button type="button" className={buttonGhostClass} onClick={() => { setMediaId(null); setPreview(null); }}>Bỏ ảnh vừa chọn</button>}
        {!preview && currentUrl && (
          <button type="button" className={buttonGhostClass} disabled={pending}
            onClick={() => { if (window.confirm("Gỡ ảnh bìa hiện tại?")) apply(null); }}>Gỡ ảnh bìa</button>
        )}
      </div>
      {progress !== null && (
        <div role="progressbar" aria-label="Tiến độ tải ảnh bìa" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}
          className="h-3 overflow-hidden rounded-full bg-champagne-soft">
          <div className="h-full bg-wine transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      {isSuperAdmin && quotaMb !== null && (
        <form className="flex flex-wrap items-end gap-3 border-t border-champagne/60 pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await setQuotaAction(mb);
            setMsg(r.error ? { kind: "error", text: r.error } : { kind: "ok", text: r.ok ?? "Xong." });
            if (!r.error) start(() => router.refresh());
          }}>
          <label className="text-base font-semibold">Hạn mức dung lượng ảnh (MB)
            <input type="number" min={50} max={102400} value={mb} onChange={(e) => setMb(Number(e.target.value))}
              className="mt-1 block min-h-12 w-48 rounded-xl border border-ink-soft/40 bg-white px-4 text-base" />
          </label>
          <button className={buttonClass}>Lưu hạn mức</button>
        </form>
      )}
    </div>
  );
}
