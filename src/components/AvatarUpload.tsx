"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Alert, buttonClass, buttonGhostClass } from "@/components/ui";
import { UploadError, prepareAndUpload } from "@/lib/image-client";
import { clearMemberAvatarAction, setMemberAvatarAction } from "@/app/actions/media";

/**
 * Chọn / đổi / gỡ ảnh đại diện của một hồ sơ thành viên. `currentUrl` là URL ĐÃ KÝ (null nếu chưa có hoặc bị che).
 * Quyền thật do CSDL kiểm tra; nơi dùng chỉ nên hiện component này khi members_view.can_edit = true.
 */
export function AvatarUpload({ memberId, name, currentUrl, size = 96 }: { memberId: string; name: string; currentUrl?: string | null; size?: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  async function onPick(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setProgress(0);
    try {
      const up = await prepareAndUpload(file, { kind: "avatar", memberId }, setProgress);
      const res = await setMemberAvatarAction(memberId, up.mediaId);
      if (res.error) setMessage({ kind: "error", text: res.error });
      else { setMessage({ kind: "ok", text: res.ok ?? "Đã cập nhật ảnh đại diện." }); startTransition(() => router.refresh()); }
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof UploadError ? e.message : "Không đổi được ảnh đại diện. Vui lòng thử lại." });
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  async function onClear() {
    if (!window.confirm("Gỡ ảnh đại diện hiện tại?")) return;
    setMessage(null);
    const res = await clearMemberAvatarAction(memberId);
    if (res.error) setMessage({ kind: "error", text: res.error });
    else { setMessage({ kind: "ok", text: res.ok ?? "Đã gỡ ảnh." }); startTransition(() => router.refresh()); }
  }

  const busy = progress !== null || pending;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={currentUrl} name={name} size={size} />
        <div className="flex flex-wrap gap-3">
          <label className={`${buttonClass} cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {busy ? "Đang tải…" : currentUrl ? "Đổi ảnh đại diện" : "Chọn ảnh đại diện"}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only"
              disabled={busy} onChange={(e) => onPick(e.target.files?.[0])} />
          </label>
          {currentUrl && <button type="button" onClick={onClear} disabled={busy} className={buttonGhostClass}>Gỡ ảnh</button>}
        </div>
      </div>
      {progress !== null && (
        <div role="progressbar" aria-label="Tiến độ tải ảnh đại diện" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}
          className="h-3 max-w-sm overflow-hidden rounded-full bg-champagne-soft">
          <div className="h-full rounded-full bg-wine transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {message && <Alert kind={message.kind}>{message.text}</Alert>}
      <p className="text-sm text-ink-soft">Ảnh được tự thu nhỏ, cắt vuông và xóa thông tin vị trí trước khi lưu.</p>
    </div>
  );
}
