import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { handleUpload, type UploadSupabase } from "@/lib/media-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Tải MỘT ảnh lên (multipart: file, thumb tùy chọn, kind, memberId, albumId, caption, takenOn).
 *  1. Phải đăng nhập + là thành viên đang hoạt động.
 *  2. Kiểm tra magic bytes, vẽ lại ảnh bằng sharp (bỏ EXIF/GPS), thu nhỏ, tạo ảnh thu nhỏ 480 px. Không xử lý được -> từ chối.
 *  3. begin_media_upload (CSDL kiểm quyền + hạn mức, cấp đường dẫn) -> ghi vào Storage bằng QUYỀN NGƯỜI DÙNG
 *     (RLS Storage chỉ cho ghi đúng đường dẫn được cấp) -> finalize_media (đối chiếu kích thước thật).
 *  4. kind=album + albumId: gắn luôn vào album.
 * Lỗi giữa chừng: hủy bản ghi chờ; phần còn sót do job /api/cron/media-cleanup dọn.
 */
export async function POST(req: Request) {
  const session = await getSession();
  const supabase = await createClient();
  return handleUpload(req, { familyId: session?.familyId ?? null, supabase: supabase as unknown as UploadSupabase });
}
