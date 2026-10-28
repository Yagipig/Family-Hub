/**
 * Lõi ký URL Storage (không phụ thuộc Next): nhận "client" có createSignedUrls, trả về bản đồ đường dẫn -> URL ĐÃ KÝ.
 * Quy tắc cứng:
 *  - KHÔNG BAO GIỜ trả URL công khai: mọi URL trả về phải qua isSignedUrl(); đường dẫn dạng URL bị bỏ.
 *  - Việc cho phép đọc do RLS Storage quyết định (client chạy bằng quyền người dùng); đường dẫn không được phép -> không có URL.
 *  - Bộ nhớ đệm ngắn hạn được khóa THEO NGƯỜI DÙNG (tránh người này dùng lại URL đã ký cho người khác).
 */
import { isMediaBucket, isSignedUrl } from "./media-core";

export type SignClient = {
  storage: {
    from(bucket: string): {
      createSignedUrls(
        paths: string[], expiresIn: number,
      ): PromiseLike<{
        data: { path: string | null; signedUrl: string | null; error: string | null }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export const DEFAULT_TTL_SECONDS = 3600;
export const MAX_TTL_SECONDS = 24 * 3600;
export const MAX_PATHS_PER_CALL = 200;

export class SignedUrlCache {
  private map = new Map<string, { url: string; expiresAt: number }>();
  constructor(private readonly maxEntries = 5000) {}
  get(key: string, now: number, minRemainingMs: number): string | null {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expiresAt - now < minRemainingMs) { this.map.delete(key); return null; }
    return e.url;
  }
  set(key: string, url: string, expiresAt: number) {
    if (this.map.size >= this.maxEntries) {
      const first = this.map.keys().next().value;
      if (first !== undefined) this.map.delete(first);
    }
    this.map.set(key, { url, expiresAt });
  }
  get size() { return this.map.size; }
  clear() { this.map.clear(); }
}

/** Đường dẫn đối tượng hợp lệ để ký: tương đối, không "..", không phải URL. */
export function isSignablePath(p: unknown): p is string {
  return (
    typeof p === "string" && p.length > 0 && p.length <= 300 &&
    !p.startsWith("/") && !p.includes("..") && !p.includes("\\") && !/^[a-z][a-z0-9+.-]*:/i.test(p) && !p.includes("?")
  );
}

export async function signUrlsCore(
  client: SignClient, cache: SignedUrlCache, userKey: string, bucket: string, paths: (string | null | undefined)[],
  ttlSeconds: number = DEFAULT_TTL_SECONDS, now: number = Date.now(),
): Promise<Record<string, string>> {
  if (!userKey || !isMediaBucket(bucket)) return {};
  const ttl = Math.max(60, Math.min(Math.floor(ttlSeconds) || DEFAULT_TTL_SECONDS, MAX_TTL_SECONDS));
  const wanted = [...new Set(paths.filter(isSignablePath))];
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const p of wanted) {
    const hit = cache.get(`${userKey}|${bucket}|${p}`, now, (ttl * 1000) / 2);
    if (hit) out[p] = hit; else missing.push(p);
  }
  for (let i = 0; i < missing.length; i += MAX_PATHS_PER_CALL) {
    const chunk = missing.slice(i, i + MAX_PATHS_PER_CALL);
    const { data, error } = await client.storage.from(bucket).createSignedUrls(chunk, ttl);
    if (error || !data) continue;
    for (const row of data) {
      if (!row.path || row.error || !row.signedUrl) continue;      // không được phép đọc / không tồn tại
      if (!chunk.includes(row.path) || !isSignedUrl(row.signedUrl)) continue; // không bao giờ trả URL công khai
      out[row.path] = row.signedUrl;
      cache.set(`${userKey}|${bucket}|${row.path}`, row.signedUrl, now + ttl * 1000);
    }
  }
  return out;
}
