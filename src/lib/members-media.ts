import "server-only";
import { signedUrls } from "@/lib/storage";

/**
 * Nối với kho ảnh (module media): đổi đường dẫn avatar_path (bucket riêng tư) thành URL ĐÃ KÝ bằng quyền người xem.
 * Đường dẫn không đọc được (hoặc rỗng) -> null => giao diện dùng chữ cái đầu.
 */
export async function signAvatarPaths(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const clean = [...new Set(paths.filter((p): p is string => !!p))];
  if (!clean.length) return {};
  return signedUrls("avatars", clean);
}

/** Thay trường `avatar` (đang chứa đường dẫn) bằng URL đã ký. */
export async function attachAvatarUrls<T extends { avatar: string | null }>(items: T[]): Promise<T[]> {
  const urls = await signAvatarPaths(items.map((i) => i.avatar));
  return items.map((i) => ({ ...i, avatar: i.avatar ? (urls[i.avatar] ?? null) : null }));
}
