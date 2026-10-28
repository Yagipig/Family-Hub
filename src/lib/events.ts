/**
 * Dữ liệu biểu mẫu sự kiện: kiểm tra đầu vào (zod), đổi giờ tường theo múi giờ chọn → UTC, dựng payload cho RPC
 * `create_event` / `update_event`. Thuần TypeScript (không import server-only) để kiểm thử được.
 * Máy chủ vẫn kiểm tra lại toàn bộ trong SQL (_event_clean) — đây chỉ là lớp tiện lợi/thông báo tiếng Việt.
 */
import { z } from "zod";
import { type SolarDate, addDays, isValidSolar, parseSolarKey, solarKey, solarToLunar } from "./lunar";
import { isValidTimeZone, wallTimeToUtc, zonedParts } from "./tz";
import type { EventRow } from "./calendar-model";

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày chưa đúng định dạng")
  .refine((v) => {
    const s = parseSolarKey(v);
    return !!s && s.year >= 1901 && s.year <= 2099;
  }, "Ngày không hợp lệ (năm 1901–2099)");
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ chưa đúng (ví dụ 19:30)");
const optionalDate = z.union([z.literal(""), dateStr]).transform((v) => v || null);
const optionalTime = z.union([z.literal(""), timeStr]).transform((v) => v || null);
const checkbox = z.union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal(""), z.null(), z.undefined()]).transform((v) => v === "on" || v === "true" || v === "1");
const optionalInt = (min: number, max: number, label: string) =>
  z.union([z.literal(""), z.null(), z.undefined(), z.coerce.number().int().min(min, label).max(max, label)]).transform((v) =>
    v === "" || v === null || v === undefined ? null : Number(v));

export const EVENT_KINDS = ["gathering", "anniversary", "memorial", "reminder", "other"] as const;

export const eventFormSchema = z.object({
  title: z.string().trim().min(1, "Vui lòng nhập tên sự kiện").max(200, "Tên sự kiện tối đa 200 ký tự"),
  kind: z.enum(EVENT_KINDS, "Loại sự kiện chưa hợp lệ"),
  date: dateStr,
  allDay: checkbox,
  startTime: optionalTime,
  endDate: optionalDate,
  endTime: optionalTime,
  timezone: z.string().refine(isValidTimeZone, "Múi giờ không hợp lệ"),
  branchId: z.union([z.literal(""), z.uuid("Nhánh chưa hợp lệ")]).transform((v) => v || null),
  visibility: z.enum(["family", "branch"], "Phạm vi xem chưa hợp lệ"),
  recurrence: z.enum(["none", "yearly_solar", "yearly_lunar"], "Kiểu lặp chưa hợp lệ"),
  lunarMonth: optionalInt(1, 12, "Tháng âm lịch từ 1 đến 12"),
  lunarDay: optionalInt(1, 30, "Ngày âm lịch từ 1 đến 30"),
  lunarLeap: checkbox,
  location: z.string().trim().max(300, "Địa điểm tối đa 300 ký tự"),
  description: z.string().trim().max(4000, "Mô tả tối đa 4000 ký tự"),
});

export type EventFormInput = Record<string, FormDataEntryValue | null | undefined>;

export type EventPayload = {
  title: string; description: string; location: string; kind: string; starts_at: string; ends_at: string | null;
  all_day: boolean; timezone: string; branch_id: string | null; visibility: string; recurrence: string;
  lunar_month: number | null; lunar_day: number | null; lunar_leap: boolean;
};

export type ParsedEventForm = { ok: true; payload: EventPayload } | { ok: false; error: string };

const str = (v: FormDataEntryValue | null | undefined) => (typeof v === "string" ? v : "");

export function parseEventForm(input: EventFormInput): ParsedEventForm {
  const parsed = eventFormSchema.safeParse({
    title: str(input.title), kind: str(input.kind) || "gathering", date: str(input.date),
    allDay: input.allDay ?? "", startTime: str(input.startTime), endDate: str(input.endDate), endTime: str(input.endTime),
    timezone: str(input.timezone), branchId: str(input.branchId), visibility: str(input.visibility) || "family",
    recurrence: str(input.recurrence) || "none", lunarMonth: input.lunarMonth ?? "", lunarDay: input.lunarDay ?? "",
    lunarLeap: input.lunarLeap ?? "", location: str(input.location), description: str(input.description),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  const f = parsed.data;
  const day = parseSolarKey(f.date) as SolarDate;

  if (f.visibility === "branch" && !f.branchId) return { ok: false, error: "Chọn nhánh khi muốn chỉ cho nhánh đó xem." };
  if (!f.allDay && !f.startTime) return { ok: false, error: "Vui lòng nhập giờ bắt đầu, hoặc chọn \"Cả ngày\"." };

  let startsAt: Date;
  let endsAt: Date | null = null;
  if (f.allDay) {
    startsAt = wallTimeToUtc(day.year, day.month, day.day, 0, 0, f.timezone);
    if (f.endDate) {
      const e = parseSolarKey(f.endDate) as SolarDate;
      if (solarKey(e) < solarKey(day)) return { ok: false, error: "Ngày kết thúc phải sau hoặc cùng ngày bắt đầu." };
      const after = addDays(e, 1);
      endsAt = wallTimeToUtc(after.year, after.month, after.day, 0, 0, f.timezone);
    }
  } else {
    const [hh, mm] = (f.startTime as string).split(":").map(Number);
    startsAt = wallTimeToUtc(day.year, day.month, day.day, hh, mm, f.timezone);
    if (f.endTime || f.endDate) {
      const e = f.endDate ? (parseSolarKey(f.endDate) as SolarDate) : day;
      const [eh, em] = (f.endTime ?? f.startTime as string).split(":").map(Number);
      endsAt = wallTimeToUtc(e.year, e.month, e.day, eh, em, f.timezone);
      if (endsAt.getTime() < startsAt.getTime()) return { ok: false, error: "Thời điểm kết thúc phải sau thời điểm bắt đầu." };
    }
  }
  if (endsAt && endsAt.getTime() - startsAt.getTime() > 31 * 86400_000) {
    return { ok: false, error: "Sự kiện kéo dài tối đa 31 ngày." };
  }

  let lunarMonth: number | null = null;
  let lunarDay: number | null = null;
  let lunarLeap = false;
  if (f.recurrence === "yearly_lunar") {
    if (f.lunarMonth !== null && f.lunarDay !== null) {
      lunarMonth = f.lunarMonth; lunarDay = f.lunarDay; lunarLeap = f.lunarLeap;
    } else if (f.lunarMonth !== null || f.lunarDay !== null) {
      return { ok: false, error: "Hãy nhập đủ cả tháng và ngày âm lịch, hoặc để trống cả hai để lấy theo ngày đã chọn." };
    } else {
      if (!isValidSolar(day.year, day.month, day.day)) return { ok: false, error: "Ngày không hợp lệ." };
      const l = solarToLunar(day.year, day.month, day.day);       // mặc định: ngày âm của ngày đã chọn
      lunarMonth = l.month; lunarDay = l.day; lunarLeap = l.leap;
    }
  }
  return {
    ok: true,
    payload: {
      title: f.title, description: f.description, location: f.location, kind: f.kind,
      starts_at: startsAt.toISOString(), ends_at: endsAt ? endsAt.toISOString() : null, all_day: f.allDay,
      timezone: f.timezone, branch_id: f.branchId, visibility: f.visibility, recurrence: f.recurrence,
      lunar_month: lunarMonth, lunar_day: lunarDay, lunar_leap: lunarLeap,
    },
  };
}

/** Giá trị ban đầu của biểu mẫu sửa (giờ hiển thị theo múi giờ GỐC của sự kiện). */
export function eventToFormDefaults(ev: EventRow) {
  const tz = isValidTimeZone(ev.timezone) ? ev.timezone : "Asia/Ho_Chi_Minh";
  const s = zonedParts(new Date(ev.starts_at), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  const key = (p: { year: number; month: number; day: number }) => `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  let endDate = "";
  let endTime = "";
  if (ev.ends_at) {
    const endInstant = new Date(ev.all_day ? new Date(ev.ends_at).getTime() - 1 : new Date(ev.ends_at).getTime());
    const e = zonedParts(endInstant, tz);
    endDate = key(e);
    endTime = ev.all_day ? "" : `${pad(e.hour)}:${pad(e.minute)}`;
  }
  return {
    title: ev.title, kind: ev.kind, date: key(s), allDay: ev.all_day, startTime: ev.all_day ? "" : `${pad(s.hour)}:${pad(s.minute)}`,
    endDate, endTime, timezone: tz, branchId: ev.branch_id ?? "", visibility: ev.visibility, recurrence: ev.recurrence,
    lunarMonth: ev.lunar_month === null ? "" : String(ev.lunar_month), lunarDay: ev.lunar_day === null ? "" : String(ev.lunar_day),
    lunarLeap: ev.lunar_leap, location: ev.location ?? "", description: ev.description ?? "",
  };
}

export const rsvpSchema = z.object({
  eventId: z.uuid(),
  occurrence: dateStr,
  response: z.enum(["yes", "no", "maybe"], "Vui lòng chọn một câu trả lời"),
  guests: z.union([z.literal(""), z.coerce.number().int().min(0, "Số khách từ 0 đến 20").max(20, "Số khách từ 0 đến 20")]).transform((v) => (v === "" ? 0 : Number(v))),
  note: z.string().trim().max(300, "Ghi chú tối đa 300 ký tự"),
});
