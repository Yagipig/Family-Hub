export function formatDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));
}

/** Chuyển lỗi Postgres/Supabase thành thông báo tiếng Việt, không lộ chi tiết nội bộ. */
export function friendlyError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "";
  if (error.code === "42501") return "Bạn không có quyền thực hiện thao tác này.";
  if (error.code === "P0001" && /last active super_admin/.test(error.message ?? ""))
    return "Không thể bỏ Super Admin cuối cùng của gia đình.";
  if (error.code === "P0001" && /yourself/.test(error.message ?? "")) return "Bạn không thể tự thu hồi quyền của chính mình.";
  if (error.code === "22023") return "Thông tin chưa hợp lệ, vui lòng kiểm tra lại.";
  return "Không thực hiện được. Vui lòng thử lại hoặc liên hệ quản trị viên.";
}
