import "server-only";
import { cache } from "react";
import type { Session } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type MemberLike, type UpcomingOccurrence, upcomingFromMembers } from "@/lib/birthdays";
import type { EventRow } from "@/lib/calendar-model";
import { type SolarDate, addDays, solarKey } from "@/lib/lunar";
import { isValidTimeZone, localDate } from "@/lib/tz";

/**
 * Lớp dữ liệu phía MÁY CHỦ của module Lịch. Mọi truy vấn chạy bằng quyền của chính người xem (RLS):
 * sự kiện ngoài phạm vi xem và trường ngày sinh/ngày mất bị che theo quyền đều KHÔNG tới được đây.
 */

export type Viewer = Session & {
  /** Múi giờ cá nhân của người xem (user_profiles.timezone), khác múi giờ gia đình. */
  viewerTz: string;
  countryCode: string | null;
};

const DEFAULT_TZ = "Asia/Ho_Chi_Minh";

export const getViewer = cache(async (session: Session): Promise<Viewer> => {
  const supabase = await createClient();
  const { data } = await supabase.from("user_profiles").select("timezone, country_code").eq("id", session.userId).maybeSingle();
  const tz = data?.timezone && isValidTimeZone(data.timezone) ? data.timezone : DEFAULT_TZ;
  return { ...session, viewerTz: tz, countryCode: data?.country_code ?? null };
});

const MEMBER_COLUMNS =
  "id, full_name, branch_id, birthday_mode, is_deceased, birth_solar_year, birth_solar_month, birth_solar_day, " +
  "birth_lunar_year, birth_lunar_month, birth_lunar_day, birth_lunar_leap, death_solar_year, death_solar_month, " +
  "death_solar_day, death_lunar_month, death_lunar_day, death_lunar_leap";

/** Hồ sơ đã che theo quyền người xem (members_view). Lỗi/không có quyền => danh sách rỗng. */
export async function loadMembersForCalendar(familyId: string): Promise<MemberLike[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members_view")
    .select(MEMBER_COLUMNS)
    .eq("family_id", familyId)
    .limit(5000);
  if (error || !data) return [];
  return data as unknown as MemberLike[];
}

const EVENT_COLUMNS =
  "id, family_id, branch_id, title, description, location, kind, starts_at, ends_at, all_day, timezone, visibility, " +
  "recurrence, lunar_month, lunar_day, lunar_leap, created_by, cancelled_at, cancel_reason";

/**
 * Sự kiện có thể rơi vào [from, to] (ngày lịch của người xem): sự kiện lặp luôn lấy (tính bước sau bằng expandEvent),
 * sự kiện một lần lấy theo khoảng thời gian có đệm 3 ngày cho chênh lệch múi giờ.
 */
export async function loadEvents(familyId: string, from: SolarDate, to: SolarDate): Promise<EventRow[]> {
  const supabase = await createClient();
  const lo = new Date(`${solarKey(addDays(from, -3))}T00:00:00Z`).toISOString();
  const hi = new Date(`${solarKey(addDays(to, 3))}T23:59:59Z`).toISOString();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("family_id", familyId)
    .lte("starts_at", hi)
    .or(`recurrence.neq.none,ends_at.gte.${lo},and(ends_at.is.null,starts_at.gte.${lo})`)
    .order("starts_at", { ascending: true })
    .limit(2000);
  if (error || !data) return [];
  return data as unknown as EventRow[];
}

export async function loadEvent(eventId: string): Promise<EventRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle();
  if (error || !data) return null;
  return data as unknown as EventRow;
}

export async function loadBranches(familyId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("branches").select("id, name").eq("family_id", familyId).is("deleted_at", null).order("name");
  return (data ?? []) as { id: string; name: string }[];
}

/**
 * Sinh nhật & ngày giỗ trong `rangeDays` ngày tới, theo ngày lịch của NGƯỜI XEM (múi giờ cá nhân).
 * Ngày sinh/ngày mất là ngày lịch (không đổi theo múi giờ); múi giờ chỉ quyết định "hôm nay" là ngày nào.
 * Chỉ trả về hồ sơ mà người xem được thấy ngày (members_view đã che phần còn lại).
 */
export async function upcomingBirthdays(viewer: Viewer, rangeDays: number, now: Date = new Date()): Promise<UpcomingOccurrence[]> {
  const members = await loadMembersForCalendar(viewer.familyId);
  const today = localDate(now, viewer.viewerTz);
  return upcomingFromMembers(members, today, rangeDays);
}

export type ClockGroup = { countryCode: string; timezone: string; names: string[]; count: number };

/**
 * Các nơi có người thân sinh sống (quốc gia + múi giờ do chính họ chọn ở /cai-dat/vi-tri), để hiện "Bây giờ ở Nhật là …".
 * Chỉ gồm thành viên cùng gia đình (RLS user_profiles: shares_family); bỏ qua người chưa chọn quốc gia.
 */
export async function loadClockGroups(familyId: string, selfId: string): Promise<ClockGroup[]> {
  const supabase = await createClient();
  const { data: ms } = await supabase.from("family_memberships").select("user_id").eq("family_id", familyId).eq("status", "active").limit(500);
  const ids = (ms ?? []).map((m) => m.user_id as string);
  if (ids.length === 0) return [];
  const { data: ps } = await supabase.from("user_profiles").select("id, display_name, country_code, timezone").in("id", ids);
  const groups = new Map<string, ClockGroup>();
  for (const p of ps ?? []) {
    if (!p.country_code || !p.timezone || !isValidTimeZone(p.timezone)) continue;
    const key = `${p.country_code}|${p.timezone}`;
    const g = groups.get(key) ?? { countryCode: p.country_code as string, timezone: p.timezone as string, names: [], count: 0 };
    g.count += 1;
    if (g.names.length < 3 && p.id !== selfId) g.names.push((p.display_name as string) || "Thành viên");
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 8);
}
