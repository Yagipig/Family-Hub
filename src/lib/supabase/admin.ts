import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

/**
 * Client service_role: BỎ QUA RLS. Chỉ dùng ở phía máy chủ cho các việc đã được
 * kiểm soát chặt (tạo tài khoản từ lời mời). Không bao giờ import vào code chạy ở trình duyệt.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}
