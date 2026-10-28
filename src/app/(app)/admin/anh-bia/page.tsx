import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { formatBytes } from "@/lib/media-core";
import { formatDateTime } from "@/lib/format";
import { Card } from "@/components/ui";
import { CoverManager } from "./CoverManager";

export const metadata = { title: "Ảnh bìa và dung lượng ảnh" };

type Usage = { used_bytes: number; quota_bytes: number; items: number; pending: number; deleted_unpurged: number };
const ACTION_LABEL: Record<string, string> = {
  "family.cover_set": "Đặt ảnh bìa", "family.cover_clear": "Gỡ ảnh bìa", "media.set_quota": "Đổi hạn mức dung lượng",
};

export default async function CoverAdminPage() {
  const session = await requireAdmin("/admin/anh-bia");
  if (session.role === "branch_admin") {
    return (
      <>
        <h1 className="text-3xl font-bold text-wine">Ảnh bìa và dung lượng ảnh</h1>
        <Card><p className="text-lg">Chỉ quản trị viên cấp gia đình được đổi ảnh bìa và xem dung lượng.</p></Card>
      </>
    );
  }
  const supabase = await createClient();
  const [{ data: fam }, { data: usageRaw }, { data: logs }] = await Promise.all([
    supabase.from("families").select("cover_path").eq("id", session.familyId).maybeSingle(),
    supabase.rpc("family_media_usage", { p_family: session.familyId }),
    supabase.from("audit_logs").select("id, action, created_at").eq("family_id", session.familyId)
      .in("action", Object.keys(ACTION_LABEL)).order("created_at", { ascending: false }).limit(10),
  ]);
  const coverUrl = await signedUrl("family-media", fam?.cover_path as string | null | undefined);
  const usage = (usageRaw ?? null) as Usage | null;
  const pct = usage && usage.quota_bytes > 0 ? Math.min(100, Math.round((Number(usage.used_bytes) / Number(usage.quota_bytes)) * 100)) : 0;

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Ảnh bìa và dung lượng ảnh</h1>
      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Ảnh bìa gia đình</h2>
        <p className="text-base text-ink-soft">Ảnh bìa hiện cho mọi thành viên ở đầu trang Bảng tin. Nên chọn ảnh ngang, rõ nét.</p>
        <CoverManager currentUrl={coverUrl} quotaMb={usage ? Math.round(Number(usage.quota_bytes) / 1048576) : null} isSuperAdmin={session.role === "super_admin"} />
      </Card>

      {usage && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Dung lượng ảnh đã dùng</h2>
          <p className="text-lg">{formatBytes(Number(usage.used_bytes))} / {formatBytes(Number(usage.quota_bytes))} ({pct}%)</p>
          <div role="progressbar" aria-label="Dung lượng ảnh đã dùng" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
            className="h-4 overflow-hidden rounded-full bg-champagne-soft">
            <div className={`h-full ${pct >= 90 ? "bg-danger" : "bg-wine"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-base text-ink-soft">
            {usage.items} ảnh đang dùng · {usage.pending} đang chờ hoàn tất · {usage.deleted_unpurged} ảnh đã xóa, chờ dọn khỏi kho (sau 3 ngày).
          </p>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Nhật ký gần đây</h2>
        {(logs ?? []).length === 0 ? <p className="text-base text-ink-soft">Chưa có thay đổi nào.</p> : (
          <ul className="space-y-1 text-base">
            {(logs ?? []).map((l) => (
              <li key={l.id as number}>{ACTION_LABEL[l.action as string] ?? l.action} · {formatDateTime(l.created_at as string, session.timezone)}</li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
