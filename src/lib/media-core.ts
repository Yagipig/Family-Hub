/**
 * Phần dùng chung (trình duyệt + máy chủ + kiểm thử) của module Media: hằng số, nhận dạng định dạng ảnh bằng
 * "magic bytes", kiểm tra đường dẫn, thông báo lỗi tiếng Việt. KHÔNG import gì từ Next/Supabase để kiểm thử độc lập.
 */
import { z } from "zod";

export const MEDIA_BUCKETS = ["avatars", "family-media"] as const;
export type MediaBucket = (typeof MEDIA_BUCKETS)[number];
export type MediaKind = "avatar" | "cover" | "album" | "post";
export const MEDIA_KINDS: readonly MediaKind[] = ["avatar", "cover", "album", "post"];

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

/** Giới hạn bucket Storage (khớp CSDL): 8 MB. */
export const BUCKET_MAX_BYTES = 8 * 1024 * 1024;
/**
 * Giới hạn thực tế của đường tải lên qua máy chủ: Vercel Hobby chặn thân yêu cầu > 4,5 MB, nên máy chủ chỉ nhận tối đa 4 MB
 * một ảnh (trình duyệt đã nén xuống ≤ 2048 px nên thường chỉ vài trăm KB).
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_REQUEST_BYTES = Math.floor(4.4 * 1024 * 1024);
/** Cạnh dài tối đa sau khi xử lý. */
export const MAIN_MAX_EDGE = 2048;
export const THUMB_EDGE = 480;
export const AVATAR_EDGE = 512;
/** Chất lượng nén (≈ 0,82 theo yêu cầu). */
export const IMAGE_QUALITY = 0.82;

export type DetectedType = "jpeg" | "png" | "webp";

/** Nhận dạng ảnh theo nội dung (không tin đuôi tệp hay Content-Type). SVG, GIF, HEIC... trả về null. */
export function detectImageType(bytes: Uint8Array): DetectedType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50   // "WEBP"
  ) return "webp";
  return null;
}

export const MIME_BY_TYPE: Record<DetectedType, AllowedMime> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATH_RE = new RegExp(`^(${UUID})/(avatar|cover|album|post)/((?:${UUID}/)?)${UUID}(?:_t)?\\.(?:jpg|png|webp)$`);

/** Đường dẫn hợp lệ theo mẫu <family_id>/<loại>/[<member_id>/]<media_id>[_t].<đuôi>. Trả về null nếu sai mẫu. */
export function parseMediaPath(path: string): { familyId: string; kind: MediaKind; isThumb: boolean } | null {
  if (typeof path !== "string" || path.length > 300) return null;
  const m = PATH_RE.exec(path);
  if (!m) return null;
  return { familyId: m[1], kind: m[2] as MediaKind, isThumb: /_t\.[a-z]+$/.test(path) };
}

export function isMediaBucket(b: string): b is MediaBucket {
  return (MEDIA_BUCKETS as readonly string[]).includes(b);
}

/** URL đã ký của Supabase Storage (có /object/sign/ và token). URL công khai (/object/public/) KHÔNG hợp lệ. */
export function isSignedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname.includes("/object/sign/") && u.searchParams.has("token");
  } catch {
    return false;
  }
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ---------- Kiểm tra dữ liệu form ----------
const optionalUuid = z.union([z.literal(""), z.uuid()]).transform((v) => v || null);

export const uploadFieldsSchema = z.object({
  kind: z.enum(["avatar", "cover", "album", "post"]),
  memberId: optionalUuid,
  albumId: optionalUuid,
  caption: z.string().trim().max(300).transform((v) => v || null),
  takenOn: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform((v) => v || null),
}).refine((v) => (v.kind === "avatar" || v.kind === "album") === (v.memberId !== null), {
  message: "Thiếu hoặc thừa hồ sơ thành viên cho loại ảnh này.",
});

// ---------- Thông báo lỗi ----------
type DbError = { code?: string; message?: string } | null | undefined;

/** Lỗi liên quan tới kho ảnh/bảng tin -> tiếng Việt, không lộ chi tiết nội bộ. Trả về null nếu không nhận ra. */
export function mediaErrorMessage(error: DbError): string | null {
  if (!error) return null;
  const msg = error.message ?? "";
  if (/quota exceeded/i.test(msg)) return "Kho ảnh của gia đình đã đầy. Vui lòng báo quản trị viên để dọn bớt hoặc tăng dung lượng.";
  if (/too many uploads/i.test(msg)) return "Bạn tải ảnh lên quá nhiều trong một giờ. Vui lòng thử lại sau.";
  if (/too many posts/i.test(msg)) return "Bạn đăng bài quá nhiều trong một giờ. Vui lòng thử lại sau.";
  if (/too many comments/i.test(msg)) return "Bạn bình luận quá nhiều trong một giờ. Vui lòng thử lại sau.";
  if (/too many reports/i.test(msg)) return "Bạn đã báo cáo quá nhiều hôm nay. Vui lòng thử lại ngày mai.";
  if (/already reported/i.test(msg)) return "Bạn đã báo cáo nội dung này rồi, quản trị viên sẽ xem xét.";
  if (/unsupported mime/i.test(msg)) return "Chỉ nhận ảnh JPG, PNG hoặc WebP.";
  if (/file too large/i.test(msg)) return "Ảnh quá lớn (tối đa 8 MB).";
  if (/too many images/i.test(msg)) return "Mỗi bài chỉ đăng tối đa 10 ảnh.";
  if (/album is full/i.test(msg)) return "Album đã đầy (tối đa 2000 ảnh).";
  if (/too many albums/i.test(msg)) return "Mỗi người chỉ có tối đa 50 album.";
  if (/empty post/i.test(msg)) return "Bài viết cần có chữ hoặc ảnh.";
  if (/branch visibility needs a branch/i.test(msg)) return "Bạn chưa thuộc nhánh họ nào nên không đăng riêng cho nhánh được.";
  if (/cannot pin a hidden/i.test(msg)) return "Không ghim được bài đang bị ẩn.";
  if (error.code === "42501") return "Bạn không có quyền thực hiện thao tác này.";
  if (error.code === "P0002") return "Không tìm thấy nội dung (có thể đã bị xóa).";
  return null;
}
