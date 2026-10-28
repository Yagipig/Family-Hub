import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, buttonClass, buttonGhostClass } from "@/components/ui";
import { ConfirmButton } from "@/components/SubmitButton";
import { EVENT_KIND_LABELS, type EventKind, expandEvent, nextInstance } from "@/lib/calendar-model";
import { type SolarDate, addDays, dayOfWeek, formatLunarLong, parseSolarKey, solarKey, solarToLunar } from "@/lib/lunar";
import { formatDateTimeVi, formatOffset, localDate, weekdayVi } from "@/lib/tz";
import { getViewer, loadEvent } from "@/lib/events-server";
import { RsvpForm } from "../RsvpForm";
import { CancelForm } from "../CancelForm";
import { deleteEventAction } from "../actions";

export const metadata = { title: "Sự kiện" };

const RESP_LABEL: Record<string, string> = { yes: "Sẽ tham dự", maybe: "Có thể", no: "Không đi được" };
const pad = (n: number) => String(n).padStart(2, "0");
const dmy = (s: SolarDate) => `${pad(s.day)}/${pad(s.month)}/${s.year}`;

export default async function EventPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ngay?: string; loi?: string }>;
}) {
  const session = await requireSession();
  const viewer = await getViewer(session);
  const { id } = await params;
  const sp = await searchParams;
  const ev = /^[0-9a-f-]{36}$/i.test(id) ? await loadEvent(id) : null;
  if (!ev) notFound();

  const now = new Date();
  // Xác định lần diễn ra: ?ngay hợp lệ (phải thật sự là một lần diễn ra), nếu không thì lần kế tiếp, nếu không thì lần gần nhất
  const asked = sp.ngay ? parseSolarKey(sp.ngay) : null;
  let inst = null;
  if (asked) {
    inst = expandEvent(ev, addDays(asked, -40), addDays(asked, 40), viewer.viewerTz).find((i) => solarKey(i.occurrence) === solarKey(asked)) ?? null;
  }
  inst ??= nextInstance(ev, now, viewer.viewerTz);
  inst ??= expandEvent(ev, addDays(localDate(now, viewer.viewerTz), -800), addDays(localDate(now, viewer.viewerTz), 0), viewer.viewerTz).at(-1) ?? null;
  const occurrenceKey = inst ? solarKey(inst.occurrence) : null;

  const supabase = await createClient();
  const [manage, mine, counts, canDelete] = await Promise.all([
    supabase.rpc("can_manage_event", { p_event: ev.id }),
    occurrenceKey
      ? supabase.from("event_rsvps").select("response, guests, note").eq("event_id", ev.id).eq("user_id", viewer.userId).eq("occurrence", occurrenceKey).maybeSingle()
      : Promise.resolve({ data: null }),
    occurrenceKey ? supabase.rpc("event_rsvp_counts", { p_event: ev.id, p_occurrence: occurrenceKey }) : Promise.resolve({ data: null }),
    can(session, "events", "delete", ev.branch_id),
  ]);
  const canManage = manage.data === true;
  const c = (Array.isArray(counts.data) ? counts.data[0] : counts.data) as { yes_count: number; maybe_count: number; no_count: number; guests: number } | null;

  let attendees: { name: string; response: string; guests: number; note: string | null }[] = [];
  if (canManage && occurrenceKey) {
    const { data: rs } = await supabase.from("event_rsvps").select("user_id, response, guests, note").eq("event_id", ev.id).eq("occurrence", occurrenceKey).order("response");
    const ids = (rs ?? []).map((r) => r.user_id as string);
    const { data: ps } = ids.length ? await supabase.from("user_profiles").select("id, display_name").in("id", ids) : { data: [] };
    const names = new Map((ps ?? []).map((p) => [p.id as string, (p.display_name as string) || "Thành viên"]));
    attendees = (rs ?? []).map((r) => ({ name: names.get(r.user_id as string) ?? "Thành viên", response: r.response as string, guests: r.guests as number, note: r.note as string | null }));
  }

  const { data: branch } = ev.branch_id ? await supabase.from("branches").select("name").eq("id", ev.branch_id).maybeSingle() : { data: null };
  const cancelled = ev.cancelled_at !== null;
  const sameTz = ev.timezone === viewer.viewerTz;

  // Mô tả thời gian
  let whenLines: string[] = [];
  if (inst) {
    if (ev.all_day) {
      const first = inst.days[0];
      const last = inst.days[inst.days.length - 1];
      whenLines = [`Cả ngày ${dmy(first)}${inst.days.length > 1 ? ` – ${dmy(last)}` : ""} (${weekdayVi(dayOfWeek(first))})`];
    } else {
      whenLines = [`${formatDateTimeVi(inst.startUtc, viewer.viewerTz)} (giờ của bạn, ${formatOffset(inst.startUtc, viewer.viewerTz)})`];
      if (!sameTz) whenLines.push(`${formatDateTimeVi(inst.startUtc, ev.timezone)} (giờ tại ${ev.timezone.replace(/_/g, " ")}, ${formatOffset(inst.startUtc, ev.timezone)})`);
      if (inst.endUtc) whenLines.push(`Kết thúc: ${formatDateTimeVi(inst.endUtc, viewer.viewerTz)}`);
    }
  }
  let lunarLine = "";
  if (inst) {
    try { lunarLine = formatLunarLong(solarToLunar(inst.occurrence.year, inst.occurrence.month, inst.occurrence.day)); } catch { /* ngoài phạm vi */ }
  }
  const recurText =
    ev.recurrence === "yearly_solar" ? "Lặp lại hằng năm theo dương lịch."
    : ev.recurrence === "yearly_lunar" ? `Lặp lại hằng năm vào ${ev.lunar_day}/${ev.lunar_month}${ev.lunar_leap ? " (tháng nhuận)" : ""} âm lịch. Năm nào không có tháng nhuận đó thì dùng tháng thường cùng số; ngày 30 của tháng thiếu thì lùi về ngày 29.`
    : null;

  return (
    <>
      <p><Link href="/lich" className="text-base font-semibold text-wine underline">‹ Về lịch</Link></p>
      {sp.loi === "xoa" && <Alert kind="error">Không xoá được sự kiện (bạn không có quyền xoá).</Alert>}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink-soft">{EVENT_KIND_LABELS[ev.kind as EventKind] ?? "Sự kiện"}{branch ? ` · Nhánh ${branch.name}` : " · Toàn gia đình"}</p>
        <h1 className={`text-3xl font-bold text-wine ${cancelled ? "line-through" : ""}`}>{ev.title}</h1>
      </div>
      {cancelled && <Alert kind="error">Sự kiện này đã huỷ{ev.cancel_reason ? `: ${ev.cancel_reason}` : "."}</Alert>}

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Thời gian và địa điểm</h2>
        {whenLines.length === 0 ? <p className="text-base text-ink-soft">Không xác định được ngày diễn ra.</p> : (
          <ul className="space-y-1 text-lg">{whenLines.map((l) => <li key={l}>{l}</li>)}</ul>
        )}
        {lunarLine && <p className="text-base text-ink-soft">Âm lịch: {lunarLine}</p>}
        {recurText && <p className="text-base text-ink-soft">{recurText}</p>}
        {ev.location && <p className="text-lg">Địa điểm: {ev.location}</p>}
        {ev.description && <p className="whitespace-pre-wrap text-base">{ev.description}</p>}
      </Card>

      {!cancelled && occurrenceKey && (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold">Bạn có tham dự không?</h2>
          {c && (
            <p className="text-base text-ink-soft">
              Đã trả lời: {c.yes_count} người sẽ tham dự, {c.maybe_count} có thể, {c.no_count} không đi được
              {c.guests > 0 ? `; ${c.guests} khách đi cùng` : ""}.
            </p>
          )}
          {viewer.role === "guest" ? (
            <p className="text-base text-ink-soft">Tài khoản khách chỉ được xem, không trả lời tham dự.</p>
          ) : (
            <RsvpForm eventId={ev.id} occurrence={occurrenceKey} current={mine.data as { response: string; guests: number; note: string | null } | null} />
          )}
        </Card>
      )}

      {canManage && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Danh sách trả lời{occurrenceKey ? ` (ngày ${dmy(parseSolarKey(occurrenceKey)!)})` : ""}</h2>
          {attendees.length === 0 ? <p className="text-base text-ink-soft">Chưa có ai trả lời.</p> : (
            <ul className="divide-y divide-champagne/50">
              {attendees.map((a, i) => (
                <li key={i} className="py-2 text-base">
                  <span className="font-semibold">{a.name}</span> · {RESP_LABEL[a.response] ?? a.response}
                  {a.guests > 0 ? ` · +${a.guests} khách` : ""}{a.note ? ` · “${a.note}”` : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {canManage && (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold">Quản lý sự kiện</h2>
          {!cancelled && (
            <div className="flex flex-wrap gap-3">
              <Link href={`/lich/su-kien/${ev.id}/sua`} className={buttonClass}>Sửa sự kiện</Link>
            </div>
          )}
          {!cancelled && <CancelForm eventId={ev.id} />}
          {canDelete && (
            <form action={deleteEventAction}>
              <input type="hidden" name="eventId" value={ev.id} />
              <ConfirmButton message="Xoá hẳn sự kiện này khỏi lịch? Không hoàn tác được." className={buttonGhostClass}>Xoá sự kiện</ConfirmButton>
            </form>
          )}
        </Card>
      )}
    </>
  );
}
