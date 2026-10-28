import "server-only";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TTL_SECONDS, SignedUrlCache, signUrlsCore } from "@/lib/storage-core";
import type { MediaBucket } from "@/lib/media-core";

const g = globalThis as unknown as { __fhSignedUrlCache?: SignedUrlCache };
const cache = (g.__fhSignedUrlCache ??= new SignedUrlCache());

/**
 * Ký URL cho các đường dẫn trong bucket PRIVATE bằng quyền của NGƯỜI ĐANG ĐĂNG NHẬP (RLS Storage quyết định ai được đọc).
 * Trả về bản đồ đường dẫn -> URL đã ký; đường dẫn không đọc được thì không có mặt trong kết quả.
 * KHÔNG BAO GIỜ trả URL công khai. Bộ nhớ đệm ngắn hạn (theo người dùng) giữ URL ổn định để trình duyệt tận dụng cache ảnh.
 * ttl: giây (mặc định 3600). Lưu ý: URL đã ký còn hiệu lực đến hết ttl kể cả khi quyền bị thu hồi giữa chừng.
 */
export async function signedUrls(
  bucket: MediaBucket, paths: (string | null | undefined)[], ttl: number = DEFAULT_TTL_SECONDS,
): Promise<Record<string, string>> {
  const session = await getSession();
  if (!session) return {};
  const supabase = await createClient();
  return signUrlsCore(supabase, cache, session.userId, bucket, paths, ttl);
}

export async function signedUrl(bucket: MediaBucket, path: string | null | undefined, ttl?: number): Promise<string | null> {
  if (!path) return null;
  const m = await signedUrls(bucket, [path], ttl);
  return m[path] ?? null;
}
