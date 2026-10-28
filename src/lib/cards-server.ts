import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Audience } from "@/lib/cards";
import { isValidTimeZone } from "@/lib/cards-tz";

/** Múi giờ của chính người dùng (user_profiles.timezone); mặc định giờ Việt Nam. */
export async function getMyTimezone(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_profiles").select("timezone").eq("id", userId).maybeSingle();
  const tz = data?.timezone as string | undefined;
  return tz && isValidTimeZone(tz) ? tz : "Asia/Ho_Chi_Minh";
}

/** Người có thể chọn làm người nhận (thành viên đang hoạt động, trừ chính mình). RPC kiểm tra quyền ở DB. */
export async function loadAudience(familyId: string): Promise<Audience[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_card_audience", { p_family: familyId });
  return (data ?? []) as Audience[];
}

export async function loadNames(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("user_profiles").select("id, display_name").in("id", unique);
  return Object.fromEntries((data ?? []).map((r: { id: string; display_name: string }) => [r.id, r.display_name]));
}

export async function loadBranches(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("branches").select("id, name").order("name");
  return (data ?? []) as { id: string; name: string }[];
}

/** Tạo thông báo còn thiếu cho thiệp đã tới giờ của CHÍNH người dùng (idempotent, DB kiểm tra). Lỗi được bỏ qua. */
export async function deliverMyDueCards(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("deliver_my_due_cards");
}

/** Quyền gửi thiệp/lì xì của chính mình (hàm DB cards_can; không dùng has_permission vì quản trị nhánh không có "nhánh" ở đây). */
export async function canUseCards(familyId: string, module: "cards" | "gifts", action: "view" | "create"): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cards_can", { p_family: familyId, p_module: module, p_action: action });
  return !error && data === true;
}
