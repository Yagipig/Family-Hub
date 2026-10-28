import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildIcs, icsFileName, type IcsEvent } from "@/lib/ics";
import { expandEvent } from "@/lib/calendar-model";
import { memberOccurrences } from "@/lib/birthdays";
import { addDays, solarKey } from "@/lib/lunar";
import { getViewer, loadEvents, loadMembersForCalendar } from "@/lib/events-server";
import { localDate } from "@/lib/tz";

/**
 * Tải lịch gia đình (.ics, RFC 5545). Cần đăng nhập; nội dung là đúng những gì người dùng được xem theo RLS
 * (sự kiện trong phạm vi xem + sinh nhật/ngày giỗ đã che theo quyền). Cửa sổ: 30 ngày trước → 365 ngày sau.
 * ?loai=su-kien|sinh-nhat để chỉ xuất một phần. Việc tải được ghi vào nhật ký (calendar.export).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const session = await requireSession();
  const viewer = await getViewer(session);
  const scopeParam = new URL(request.url).searchParams.get("loai");
  const scope = scopeParam === "su-kien" ? "events" : scopeParam === "sinh-nhat" ? "birthdays" : "all";

  const now = new Date();
  const today = localDate(now, viewer.viewerTz);
  const from = addDays(today, -30);
  const to = addDays(today, 365);
  const out: IcsEvent[] = [];

  if (scope !== "birthdays") {
    const events = await loadEvents(viewer.familyId, from, to);
    for (const ev of events) {
      for (const inst of expandEvent(ev, from, to, viewer.viewerTz)) {
        const occ = solarKey(inst.occurrence);
        const base = {
          uid: `ev-${ev.id}-${occ}@family-hub`,
          summary: ev.title,
          description: ev.description,
          location: ev.location,
          status: ev.cancelled_at ? ("CANCELLED" as const) : ("CONFIRMED" as const),
          categories: ["Sự kiện"],
        };
        if (inst.allDay) {
          out.push({ ...base, allDay: true, start: inst.days[0], end: inst.days[inst.days.length - 1] });
        } else {
          out.push({ ...base, start: inst.startUtc, end: inst.endUtc });
        }
      }
    }
  }
  if (scope !== "events") {
    const members = await loadMembersForCalendar(viewer.familyId);
    for (const m of members) {
      for (const o of memberOccurrences(m, from, to)) {
        const isBirthday = o.kind === "birthday";
        out.push({
          uid: `${isBirthday ? "bday" : "gio"}-${m.id}-${solarKey(o.date)}@family-hub`,
          summary: isBirthday ? `Sinh nhật ${o.name}` : `Giỗ ${o.name}`,
          description: o.years !== null ? (isBirthday ? `Tròn ${o.years} tuổi` : `Giỗ lần thứ ${o.years}`) : null,
          allDay: true,
          start: o.date,
          categories: [isBirthday ? "Sinh nhật" : "Ngày giỗ"],
        });
      }
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("log_calendar_export", { p_family: viewer.familyId, p_scope: scope, p_count: out.length });
  if (error) return new Response("Không có quyền tải lịch.", { status: 403, headers: { "Cache-Control": "no-store" } });

  const body = buildIcs({ calName: `Lịch ${viewer.familyName}`, events: out, now });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFileName("lich-gia-dinh", now)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
