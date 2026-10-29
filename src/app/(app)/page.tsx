import Link from "next/link";
import { can, requireSession, ROLE_LABELS } from "@/lib/auth";
import { NAV } from "@/lib/nav";
import { getViewer, upcomingBirthdays } from "@/lib/events-server";
import { createClient } from "@/lib/supabase/server";
import { Card, buttonGhostClass } from "@/components/ui";

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
      <h1 className="text-3xl font-bold text-wine">Xin chào, {session.displayName}</h1>
      <Card>
        <p className="text-base">
          Bạn đang ở không gian riêng của <strong>{session.familyName}</strong> với vai trò{" "}
          <strong>{ROLE_LABELS[session.role]}</strong>.
        </p>
        {unreadCount > 0 && (
          <p className="mt-3 text-base">
            Bạn có <strong>{unreadCount}</strong> thông báo chưa đọc.{" "}
            <Link href="/thong-bao" className="font-semibold text-wine underline">Xem thông báo</Link>
          </p>
        )}
      </Card>

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

      <section aria-label="Lối tắt" className="grid gap-4 sm:grid-cols-2">
        {shortcuts.map((item) => (
          <Link key={item.href} href={item.href} className="block focus-visible:outline-none">
            <Card className="h-full hover:border-wine">
              <h2 className="text-xl font-bold text-wine">{item.label}</h2>
            </Card>
          </Link>
        ))}
      </section>
    </>
  );
}
