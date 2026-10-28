/** Logic job dọn media (tách khỏi route để kiểm thử). Chỉ import tương đối. */
import { createHash, timingSafeEqual } from "node:crypto";

const sha = (s: string) => createHash("sha256").update(s).digest();

/** Authorization phải đúng "Bearer <CRON_SECRET>" (so sánh thời gian cố định). Thiếu/ngắn CRON_SECRET => từ chối tất cả. */
export function isCronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16) return false;
  return timingSafeEqual(sha(authorization ?? ""), sha(`Bearer ${secret}`));
}

type Row = { id: string; bucket: string; path: string; thumb_path: string | null };
export type CleanupAdmin = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  storage: { from(bucket: string): { remove(paths: string[]): PromiseLike<{ error: { message?: string } | null }> } };
};

/** Xóa tệp thật khỏi Storage rồi mới đánh dấu đã dọn trong CSDL (lỗi Storage => dòng vẫn còn để thử lại lần sau). */
export async function runMediaCleanup(admin: CleanupAdmin): Promise<{ ok: boolean; purged: number; failed: number; error?: string }> {
  let purged = 0;
  let failed = 0;
  for (let round = 0; round < 10; round++) {
    const { data, error } = await admin.rpc("media_cleanup_list", { p_pending_hours: 24, p_deleted_days: 3, p_limit: 200 });
    if (error) return { ok: false, purged, failed, error: "Không đọc được danh sách dọn dẹp" };
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) break;

    const done: string[] = [];
    for (const bucket of new Set(rows.map((r) => r.bucket))) {
      const group = rows.filter((r) => r.bucket === bucket);
      const paths = group.flatMap((r) => (r.thumb_path ? [r.path, r.thumb_path] : [r.path]));
      const { error: rmError } = await admin.storage.from(bucket).remove(paths); // tệp không tồn tại không phải lỗi
      if (rmError) failed += group.length;
      else done.push(...group.map((r) => r.id));
    }
    if (done.length === 0) break; // Storage lỗi: dừng, lần sau thử lại
    const { data: n, error: finError } = await admin.rpc("media_cleanup_finish", { p_ids: done, p_pending_hours: 24, p_deleted_days: 3 });
    if (finError) return { ok: false, purged, failed, error: "Không đánh dấu được kết quả dọn dẹp" };
    purged += Number(n ?? 0);
    if (rows.length < 200) break;
  }
  return { ok: true, purged, failed };
}
