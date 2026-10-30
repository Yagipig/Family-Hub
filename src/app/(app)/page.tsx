import Link from "next/link";
import { can, requireSession, ROLE_LABELS } from "@/lib/auth";
import { NAV } from "@/lib/nav";
import { getViewer, upcomingBirthdays } from "@/lib/events-server";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { NavIcon } from "@/components/NavIcons";

export const metadata = { title: "Trang chủ" };

function whenText(days: number): string {
  if (days === 0) return "Hôm nay";
  if (days === 1) return "Ngày mai";
  return `${days} ngày nữa`;
}

export default async function HomePage() {
  const session = await requireSession();
  const supabase = await createClient();

  // Chỉ hiện các khối mà người dùng có quyền xem; mọi dữ liệu đều đã qua RLS.
  const [canEvents, viewer, unread] = await Promise.all([
    can(session, "events", "view"),
    getViewer(session),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  const upcoming = canEvents ? (await upcomingBirthdays(viewer, 30)).slice(0, 6) : [];
  const unreadCount = unread.count ?? 0;

  // Song song như ở layout (và can() đã có cache theo request nên phần lớn là tra bộ nhớ).
  const shortcuts = (
    await Promise.all(
      NAV.map(async (item) => {
        if (!item.enabled || item.href === "/" || item.href === "/cai-dat") return null;
        if (item.roles && !item.roles.includes(session.role)) return null;
        if (item.module && !(await can(session, item.module, "view"))) return null;
        return item;
      }),
    )
  ).filter((item): item is (typeof NAV)[number] => item !== null);

  return (
    <>
      {/* Mobile-first welcome header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-wine md:text-3xl">
          Xin chào, {session.displayName.split(" ")[0]} 👋
        </h1>
        <p className="text-base text-ink-soft">
          {session.familyName} · {ROLE_LABELS[session.role]}
        </p>
      </div>

      {/* Quick status card */}
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink-soft">Không gian gia đình</p>
            <p className="text-lg font-semibold text-wine">{session.familyName}</p>
          </div>
          {unreadCount > 0 && (
            <Link href="/thong-bao" className="rounded-full bg-wine px-3 py-1 text-sm font-bold text-white">
              {unreadCount} thông báo
            </Link>
          )}
        </div>
      </Card>

      {/* Upcoming events - compact for mobile */}
      {canEvents && (
        <Card className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-wine">Sắp tới (30 ngày)</h2>
            <Link href="/lich" className="text-sm font-semibold text-wine underline">Xem lịch</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink-soft">Chưa có sự kiện nào trong 30 ngày tới.</p>
          ) : (
            <ul className="divide-y divide-champagne/40 text-sm">
              {upcoming.map((o) => (
                <li key={`${o.memberId}-${o.kind}`} className="flex items-center justify-between py-2">
                  <span className="min-w-0 truncate pr-2">
                    <strong>{o.name}</strong> — {o.kind === "birthday" ? "sinh nhật" : "ngày giỗ"}
                    {o.years !== null && <span className="text-ink-soft"> ({o.years})</span>}
                  </span>
                  <span className="shrink-0 font-semibold text-wine">{whenText(o.daysUntil)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Shortcut grid - optimized for phones: 2 columns, large touch targets */}
      <section aria-label="Lối tắt nhanh" className="grid grid-cols-2 gap-3 sm:gap-4">
        {shortcuts.map((item) => (
          <Link key={item.href} href={item.href} className="block active:scale-[0.985] focus-visible:outline-none">
            <Card className="flex h-full flex-col items-center justify-center gap-2.5 py-5 text-center transition active:bg-champagne-soft/30 hover:border-wine">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-champagne-soft text-wine">
                <NavIcon href={item.href} />
              </span>
              <span className="text-sm font-semibold leading-tight text-wine">{item.label}</span>
            </Card>
          </Link>
        ))}
      </section>
    </>
  );
}
