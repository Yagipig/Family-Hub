import "server-only";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Múi giờ của chính người dùng (user_profiles.timezone); mặc định Asia/Ho_Chi_Minh. */
export async function loadUserTimezone(supabase: Supabase, userId: string): Promise<string> {
  const { data } = await supabase.from("user_profiles").select("timezone").eq("id", userId).maybeSingle();
  return data?.timezone ?? "Asia/Ho_Chi_Minh";
}

/**
 * Vai trò của tôi có quyền dùng tin nhắn không? Dùng RPC chat_my_role_allows (không xét phạm vi nhánh), vì
 * has_permission(..., 'create') với admin nhánh và p_branch = null luôn từ chối.
 */
export async function chatAllowed(supabase: Supabase, familyId: string, action: "view" | "create"): Promise<boolean> {
  const { data, error } = await supabase.rpc("chat_my_role_allows", { p_family: familyId, p_action: action });
  return !error && data === true;
}
