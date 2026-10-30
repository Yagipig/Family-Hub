import Link from "next/link";
import { EVENT_KIND_LABELS, type CalendarItem, type EventKind } from "@/lib/calendar-model";
import { DotShape } from "./MonthGrid";

export function ItemRow({ item, showLunar }: { item: CalendarItem; showLunar: boolean }) {
  const body = (
    <div className="flex items-start gap-2 md:gap-3">
      <span className="mt-1.5 md:mt-2"><DotShape type={item.type} /></span>
      <div className="min-w-0">
        <p className={`text-base font-semibold md:text-lg ${item.cancelled ? "line-through text-ink-soft" : ""}`}>
          {item.time && <span className="mr-1.5 text-wine">{item.time}</span>}
          {item.title}
        </p>
        <p className="text-xs text-ink-soft md:text-sm">
          {item.type === "event" && item.eventKind ? (EVENT_KIND_LABELS[item.eventKind as EventKind] ?? "Sự kiện") : item.type === "birthday" ? "Sinh nhật" : "Ngày giỗ"}
          {item.subtitle ? ` · ${item.subtitle}` : ""}
          {item.cancelled ? " · Đã huỷ" : ""}
          {showLunar && item.lunarText ? ` · Âm ${item.lunarText}` : ""}
        </p>
      </div>
    </div>
  );
  return item.type === "event" ? (
    <Link href={item.href} className="block min-h-11 rounded-xl border border-champagne/50 bg-white px-3 py-2.5 hover:bg-champagne-soft md:min-h-12 md:px-4 md:py-3">{body}</Link>
  ) : (
    <div className="min-h-11 rounded-xl border border-champagne/50 bg-white px-3 py-2.5 md:min-h-12 md:px-4 md:py-3">{body}</div>
  );
}
