import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, buttonClass, buttonGhostClass } from "@/components/ui";
import {
  type CalendarItem, buildCalendarItems, monthGrid, monthRange, shiftMonth,
} from "@/lib/calendar-model";
import { buildCalendarHref, parseCalendarParams, toggleShow, type ShowKinds } from "@/lib/calendar-params";
import { addDays, canChiDay, dayOfWeek, formatLunarLong, parseSolarKey, solarKey, solarToLunar, diffDays } from "@/lib/lunar";
import { countryName } from "@/lib/countries";
import { localDate, weekdayVi } from "@/lib/tz";
import { getViewer, loadClockGroups, loadEvents, loadMembersForCalendar } from "@/lib/events-server";
import { Legend, MonthGrid } from "./MonthGrid";
import { ItemRow } from "./ItemList";
import { WorldClocks } from "./WorldClocks";

export const metadata = { title: "Lịch gia đình" };

type SP = Promise<Record<string, string | string[] | undefined>>;

function keepKinds(items: CalendarItem[], show: ShowKinds): CalendarItem[] {
  return items.filter((i) => (i.type === "birthday" ? show.birthday : i.type === "death_anniversary" ? show.death : show.event));
}

function groupByDate(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  for (const it of items) {
    const arr = map.get(it.date) ?? [];
    arr.push(it);
    map.set(it.date, arr);
  }
  return map;
}

export default async function CalendarPage({ searchParams }: { searchParams: SP }) {
  const session = await requireSession();
  const viewer = await getViewer(session);
  const sp = await searchParams;
  const now = new Date();
  const today = localDate(now, viewer.viewerTz);
  const todayKey = solarKey(today);
  const params = parseCalendarParams(sp, today);

  const supabase = await createClient();
  const [canCreateFamily, canCreateBranch] = await Promise.all([
    supabase.rpc("can_create_event", { p_family: viewer.familyId, p_branch: null }),
    viewer.branchId ? supabase.rpc("can_create_event", { p_family: viewer.familyId, p_branch: viewer.branchId }) : Promise.resolve({ data: false }),
  ]);
  const canCreate = canCreateFamily.data === true || canCreateBranch.data === true;

  // Khoảng ngày cần dữ liệu
  const monthly = params.view === "thang";
  const range = monthly ? monthRange(params.year, params.month) : { from: today, to: addDays(today, 59) };
  const [events, members, clockGroups] = await Promise.all([
    loadEvents(viewer.familyId, range.from, range.to),
    loadMembersForCalendar(viewer.familyId),
    loadClockGroups(viewer.familyId, viewer.userId),
  ]);
  const allItems = keepKinds(
    buildCalendarItems({ events, members, viewerTz: viewer.viewerTz, from: range.from, to: range.to }),
    params.show,
  );
  const byDay = groupByDate(allItems);

  const prev = shiftMonth(params.year, params.month, -1);
  const next = shiftMonth(params.year, params.month, 1);
  const isCurrentMonth = params.year === today.year && params.month === today.month;
  const selectedKey = params.day ?? (isCurrentMonth ? todayKey : `${params.year}-${String(params.month).padStart(2, "0")}-01`);
  const selected = parseSolarKey(selectedKey) ?? today;
  let selectedLunar = null;
  try { selectedLunar = solarToLunar(selected.year, selected.month, selected.day); } catch { /* ngoài phạm vi hỗ trợ */ }

  const chip = (kind: keyof ShowKinds, label: string) => {
    const on = params.show[kind];
    return (
      <Link
        key={kind}
        href={buildCalendarHref(params, { show: toggleShow(params.show, kind) })}
        aria-label={`${label}: đang ${on ? "hiện" : "ẩn"}. Bấm để ${on ? "ẩn" : "hiện"}`}
        className={`inline-flex min-h-12 items-center rounded-full border px-5 text-base font-semibold ${on ? "border-wine bg-wine text-white" : "border-wine text-wine hover:bg-champagne-soft"}`}
      >
        {on ? "✓ " : ""}{label}
      </Link>
    );
  };

  const clocks = clockGroups
    .filter((g) => g.timezone !== viewer.viewerTz)
    .map((g) => ({ countryName: countryName(g.countryCode), timezone: g.timezone, names: g.names, count: g.count }));

  return (
    <>
	      <div className="flex flex-wrap items-center gap-2">
	        <h1 className="text-2xl font-bold tracking-tight text-wine md:text-3xl">Lịch gia đình</h1>
	        <div className="ml-auto flex flex-wrap gap-2">
	          {canCreate && <Link href="/lich/su-kien/moi" className={buttonClass + " text-sm"}>+ Thêm</Link>}
	          <a href="/lich/xuat.ics" className={buttonGhostClass + " text-sm"} download>Tải .ics</a>
	        </div>
	      </div>

      <nav aria-label="Chế độ xem và bộ lọc" className="flex flex-wrap items-center gap-2">
        <Link href={buildCalendarHref(params, { view: "thang" })} aria-current={monthly ? "page" : undefined}
          className={monthly ? buttonClass : buttonGhostClass}>Theo tháng</Link>
        <Link href={buildCalendarHref(params, { view: "sap-toi" })} aria-current={!monthly ? "page" : undefined}
          className={!monthly ? buttonClass : buttonGhostClass}>Sắp tới 60 ngày</Link>
        <span className="mx-1 hidden h-8 w-px bg-champagne sm:block" aria-hidden />
        {chip("birthday", "Sinh nhật")}
        {chip("death", "Ngày giỗ")}
        {chip("event", "Sự kiện")}
        <Link href={buildCalendarHref(params, { lunar: !params.lunar })}
          aria-label={`Âm lịch: đang ${params.lunar ? "hiện" : "ẩn"}. Bấm để ${params.lunar ? "ẩn" : "hiện"}`}
          className={`inline-flex min-h-12 items-center rounded-full border px-5 text-base font-semibold ${params.lunar ? "border-wine bg-wine text-white" : "border-wine text-wine hover:bg-champagne-soft"}`}>
          {params.lunar ? "✓ " : ""}Âm lịch
        </Link>
      </nav>

      {monthly ? (
        <>
          <Card className="space-y-4 !p-4 sm:!p-6">
            <div className="flex items-center justify-between gap-2">
              <Link href={buildCalendarHref(params, { year: prev.year, month: prev.month, day: null })} className={buttonGhostClass} aria-label="Tháng trước">‹ Trước</Link>
              <h2 className="text-center text-xl font-bold">Tháng {params.month} năm {params.year}</h2>
              <Link href={buildCalendarHref(params, { year: next.year, month: next.month, day: null })} className={buttonGhostClass} aria-label="Tháng sau">Sau ›</Link>
            </div>
            {!isCurrentMonth && (
              <p className="text-center">
                <Link href={buildCalendarHref(params, { year: today.year, month: today.month, day: todayKey })} className="text-base font-semibold text-wine underline">Về hôm nay</Link>
              </p>
            )}
            <MonthGrid weeks={monthGrid(params.year, params.month)} itemsByDay={byDay} params={params} todayKey={todayKey} selectedKey={selectedKey} />
            <Legend />
          </Card>

          <Card className="space-y-3" >
            <h2 className="text-xl font-bold">
              {weekdayVi(dayOfWeek(selected))}, ngày {selected.day} tháng {selected.month} năm {selected.year}
              {selectedKey === todayKey ? " (hôm nay)" : ""}
            </h2>
            {selectedLunar && (
              <p className="text-base text-ink-soft">
                Âm lịch: {formatLunarLong(selectedLunar)} · Ngày {canChiDay(selected)}
              </p>
            )}
            {(byDay.get(selectedKey) ?? []).length === 0 ? (
              <p className="text-base text-ink-soft">Ngày này chưa có sinh nhật, ngày giỗ hay sự kiện nào.</p>
            ) : (
              <ul className="space-y-2">
                {(byDay.get(selectedKey) ?? []).map((it) => <li key={it.key}><ItemRow item={it} showLunar={params.lunar} /></li>)}
              </ul>
            )}
          </Card>
        </>
      ) : (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold">Sắp tới trong 60 ngày</h2>
          {allItems.length === 0 ? (
            <p className="text-base text-ink-soft">Không có gì trong 60 ngày tới (với bộ lọc đang chọn).</p>
          ) : (
            [...byDay.entries()].map(([key, items]) => {
              const d = parseSolarKey(key)!;
              const n = diffDays(today, d);
              const label = n === 0 ? "Hôm nay" : n === 1 ? "Ngày mai" : `Còn ${n} ngày`;
              return (
                <section key={key} aria-label={`Ngày ${d.day}/${d.month}`} className="space-y-2">
                  <h3 className="text-base font-bold text-wine">
                    {weekdayVi(dayOfWeek(d))} {String(d.day).padStart(2, "0")}/{String(d.month).padStart(2, "0")}/{d.year} · {label}
                  </h3>
                  <ul className="space-y-2">{items.map((it) => <li key={it.key}><ItemRow item={it} showLunar={params.lunar} /></li>)}</ul>
                </section>
              );
            })
          )}
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Giờ ở các nơi</h2>
        <WorldClocks clocks={clocks} homeTz={viewer.viewerTz} homeLabel={viewer.countryCode ? countryName(viewer.countryCode) : viewer.viewerTz} />
        <p className="text-sm text-ink-soft">
          Giờ trên lịch hiển thị theo múi giờ của bạn ({viewer.viewerTz}).{" "}
          <Link href="/cai-dat/vi-tri" className="font-semibold text-wine underline">Đổi quốc gia và múi giờ</Link>
        </p>
      </Card>
    </>
  );
}
