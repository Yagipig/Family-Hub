import Link from "next/link";
import { EVENT_KIND_LABELS, type CalendarItem, type EventKind } from "@/lib/calendar-model";
import { DotShape } from "./MonthGrid";

export function ItemRow({ item, showLunar }: { item: CalendarItem; showLunar: boolean }) {
  const body = (
    <div className="flex items-start gap-3">
      <span className="mt-2"><DotShape type={item.type} /></span>
      <div className="min-w-0">
        <p className={`text-lg font-semibold ${item.cancelled ? "line-through text-ink-soft" : ""}`}>
          {item.time && <span className="mr-2 text-wine">{item.time}</span>}
          {item.title}
        </p>
        <p className="text-sm text-ink-soft">
          {item.type === "event" && item.eventKind ? (EVENT_KIND_LABELS[item.eventKind as EventKind] ?? "Sự kiện") : item.type === "birthday" ? "Sinh nhật" : "Ngày giỗ"}
          {item.subtitle ? ` · ${item.subtitle}` : ""}
          {item.cancelled ? " · Đã huỷ" : ""}
          {showLunar && item.lunarText ? ` · Âm lịch ${item.lunarText}` : ""}
        </p>
      </div>
    </div>
  );
  return item.type === "event" ? (
    <Link href={item.href} className="block min-h-12 rounded-xl border border-champagne/50 bg-white px-4 py-3 hover:bg-champagne-soft">{body}</Link>
  ) : (
    <div className="min-h-12 rounded-xl border border-champagne/50 bg-white px-4 py-3">{body}</div>
  );
}
