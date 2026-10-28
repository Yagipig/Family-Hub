/**
 * Tham số URL của trang /lich (thuần TypeScript, kiểm thử được). Trạng thái hiển thị nằm trên URL
 * (không dùng localStorage) nên chia sẻ/đánh dấu trang được và hoạt động cả khi tắt JavaScript.
 *   xem=thang|sap-toi   thang=YYYY-MM   ngay=YYYY-MM-DD   am=0 (ẩn âm lịch)   loc=sn,gio,sk (loại hiển thị)
 */
import { type SolarDate, parseSolarKey, solarKey } from "./lunar";
import { monthKey, parseMonthParam } from "./calendar-model";

export type ShowKinds = { birthday: boolean; death: boolean; event: boolean };
export type CalendarParams = {
  view: "thang" | "sap-toi";
  year: number;
  month: number;
  day: string | null;
  lunar: boolean;
  show: ShowKinds;
};

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const LOC_CODES: Record<keyof ShowKinds, string> = { birthday: "sn", death: "gio", event: "sk" };

export function parseShow(v: string | undefined): ShowKinds {
  if (!v) return { birthday: true, death: true, event: true };
  const set = new Set(v.split(",").map((s) => s.trim()));
  const show = { birthday: set.has("sn"), death: set.has("gio"), event: set.has("sk") };
  return show.birthday || show.death || show.event ? show : { birthday: true, death: true, event: true };
}

export function parseCalendarParams(sp: SearchParams, today: SolarDate): CalendarParams {
  const dayRaw = first(sp.ngay);
  const parsedDay = dayRaw ? parseSolarKey(dayRaw) : null;
  const dayOk = parsedDay && parsedDay.year >= 1901 && parsedDay.year <= 2099 ? solarKey(parsedDay) : null;
  // Có ?ngay mà không có ?thang: hiển thị tháng chứa ngày đó
  const monthRaw = first(sp.thang);
  const base = !monthRaw && parsedDay && dayOk ? parsedDay : today;
  const { year, month } = parseMonthParam(monthRaw, base);
  return {
    view: first(sp.xem) === "sap-toi" ? "sap-toi" : "thang",
    year, month, day: dayOk,
    lunar: first(sp.am) !== "0",
    show: parseShow(first(sp.loc)),
  };
}

export function buildCalendarHref(p: CalendarParams, patch: Partial<CalendarParams> = {}): string {
  const q: CalendarParams = { ...p, ...patch };
  const params: string[] = [];
  if (q.view === "sap-toi") params.push("xem=sap-toi");
  if (q.view === "thang") params.push(`thang=${monthKey(q.year, q.month)}`);
  if (q.day && q.view === "thang") params.push(`ngay=${q.day}`);
  if (!q.lunar) params.push("am=0");
  const all = q.show.birthday && q.show.death && q.show.event;
  if (!all) {
    const codes = (Object.keys(LOC_CODES) as (keyof ShowKinds)[]).filter((k) => q.show[k]).map((k) => LOC_CODES[k]);
    if (codes.length > 0) params.push(`loc=${codes.join(",")}`);
  }
  return params.length ? `/lich?${params.join("&")}` : "/lich";
}

/** Bật/tắt một loại; luôn giữ ít nhất một loại đang bật. */
export function toggleShow(show: ShowKinds, kind: keyof ShowKinds): ShowKinds {
  const next = { ...show, [kind]: !show[kind] };
  return next.birthday || next.death || next.event ? next : show;
}
