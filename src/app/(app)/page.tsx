import Link from "next/link";
import { can, requireSession, ROLE_LABELS } from "@/lib/auth";
import { NAV } from "@/lib/nav";
import { getViewer, upcomingBirthdays } from "@/lib/events-server";
import { createClient } from "@/lib/supabase/server";
import { Card, buttonGhostClass } from "@/components/ui";
import { NavTile } from "@/components/NavIcons";
import { SakuraPetals } from "@/components/SakuraPetals";

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
      <SakuraPetals />
      <section aria-label="Ảnh gia đình" className="relative overflow-hidden rounded-3xl shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/family-home.jpg" alt="Ảnh đại gia đình" className="h-56 w-full object-cover object-[50%_22%] sm:h-72 lg:h-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-6">
          <h1 className="text-2xl font-bold drop-shadow-md sm:text-3xl">Xin chào, {session.displayName}</h1>
          <p className="mt-1 text-sm text-white/90 drop-shadow sm:text-base">
            Không gian riêng của <strong>{session.familyName}</strong> · vai trò <strong>{ROLE_LABELS[session.role]}</strong>
          </p>
        </div>
        {unreadCount > 0 && (
          <Link
            href="/thong-bao"
            className="absolute right-4 top-4 rounded-full bg-wine/90 px-4 py-2 text-sm font-bold text-white shadow-lg hover:bg-wine"
          >
            🔔 {unreadCount} thông báo mới
          </Link>
        )}
      </section>

      {canEvents && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Sắp tới trong 30 ngày</h2>
          {upcoming.length === 0 ? (
            <p className="text-base text-ink-soft">Chưa có sinh nhật hay ngày giỗ nào trong 30 ngày tới (hoặc ngày chưa được chia sẻ với bạn).</p>
          ) : (
            <ul className="divide-y divide-champagne/50 text-base">
              {upcoming.map((o) => (
                <li key={`${o.memberId}-${o.kind}`} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
                  <span>
                    <strong>{o.name}</strong> — {o.kind === "birthday" ? "sinh nhật" : "ngày giỗ"}
                    {o.years !== null ? ` (${o.kind === "birthday" ? `${o.years} tuổi` : `giỗ lần ${o.years}`})` : ""}
                  </span>
                  <span className="font-semibold text-wine">{whenText(o.daysUntil)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/lich" className={buttonGhostClass}>Mở lịch gia đình</Link>
        </Card>
      )}

      <section aria-label="Lối tắt" className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {shortcuts.map((item) => (
          <Link key={item.href} href={item.href} className="block focus-visible:outline-none">
            <Card className="flex h-full flex-col items-center gap-2 py-5 text-center hover:border-wine">
              <NavTile href={item.href} />
              <span className="text-base font-bold text-wine">{item.label}</span>
            </Card>
          </Link>
        ))}
      </section>
    </>
  );
}
