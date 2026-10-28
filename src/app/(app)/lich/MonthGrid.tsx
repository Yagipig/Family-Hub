import Link from "next/link";
import { type CalendarItem } from "@/lib/calendar-model";
import { type GridDay } from "@/lib/calendar-model";
import { buildCalendarHref, type CalendarParams } from "@/lib/calendar-params";
import { formatLunarShort } from "@/lib/lunar";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function DotShape({ type }: { type: CalendarItem["type"] }) {
  // Hình dạng khác nhau (không chỉ màu): tròn = sinh nhật, vuông = ngày giỗ, thoi = sự kiện
  if (type === "birthday") return <span aria-hidden className="inline-block size-2.5 rounded-full bg-champagne" />;
  if (type === "death_anniversary") return <span aria-hidden className="inline-block size-2.5 bg-ink-soft" />;
  return <span aria-hidden className="inline-block size-2.5 rotate-45 bg-wine" />;
}

function describe(day: GridDay, items: CalendarItem[], lunar: boolean): string {
  const b = items.filter((i) => i.type === "birthday").length;
  const g = items.filter((i) => i.type === "death_anniversary").length;
  const e = items.filter((i) => i.type === "event").length;
  const parts = [`Ngày ${day.date.day} tháng ${day.date.month}`];
  if (lunar && day.lunar) parts.push(`âm lịch ${formatLunarShort(day.lunar)}`);
  if (b) parts.push(`${b} sinh nhật`);
  if (g) parts.push(`${g} ngày giỗ`);
  if (e) parts.push(`${e} sự kiện`);
  if (!b && !g && !e) parts.push("không có gì");
  return parts.join(", ");
}

export function MonthGrid({
  weeks, itemsByDay, params, todayKey, selectedKey,
}: {
  weeks: GridDay[][];
  itemsByDay: Map<string, CalendarItem[]>;
  params: CalendarParams;
  todayKey: string;
  selectedKey: string;
}) {
  return (
    <div role="group" aria-label={`Lịch tháng ${params.month} năm ${params.year}`}>
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-sm font-bold text-ink-soft" aria-hidden>
        {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => {
          const items = itemsByDay.get(day.key) ?? [];
          const isToday = day.key === todayKey;
          const isSel = day.key === selectedKey;
          const types = [...new Set(items.map((i) => i.type))] as CalendarItem["type"][];
          return (
            <Link
              key={day.key}
              href={buildCalendarHref(params, { day: day.key, year: day.date.year, month: day.date.month })}
              scroll={false}
              aria-label={describe(day, items, params.lunar) + (isSel ? ", đang chọn" : "")}
              aria-current={isToday ? "date" : undefined}
              className={[
                "flex min-h-16 flex-col items-center justify-start rounded-lg border px-0.5 py-1 text-center sm:min-h-20",
                day.inMonth ? "bg-white text-ink" : "bg-cream text-ink-soft/60",
                isSel ? "border-wine ring-2 ring-wine" : isToday ? "border-champagne bg-champagne-soft" : "border-champagne/40",
              ].join(" ")}
            >
              <span className={`text-lg font-bold leading-tight ${isToday ? "text-wine" : ""}`}>{day.date.day}</span>
              {params.lunar && day.lunar && (
                <span className="text-[11px] leading-tight text-ink-soft sm:text-xs">
                  {day.lunar.day === 1 || day.date.day === 1 ? formatLunarShort(day.lunar) : day.lunar.day}
                </span>
              )}
              <span className="mt-auto flex min-h-3 items-center justify-center gap-1 pt-1">
                {types.map((t) => <DotShape key={t} type={t} />)}
                {items.length > 1 && <span className="text-[10px] font-semibold leading-none text-ink-soft">{items.length}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft" aria-label="Chú thích">
      <li className="flex items-center gap-2"><DotShape type="birthday" /> Sinh nhật</li>
      <li className="flex items-center gap-2"><DotShape type="death_anniversary" /> Ngày giỗ</li>
      <li className="flex items-center gap-2"><DotShape type="event" /> Sự kiện</li>
    </ul>
  );
}
