import Link from "next/link";
import { can, requireSession } from "@/lib/auth";
import { NAV } from "@/lib/nav";
import { signOut } from "@/app/actions/auth";
import { NotificationBell } from "@/components/NotificationBell";
import { FamilyCoverBackdrop } from "@/components/FamilyCover";
import { MobileTabBar, type TabItem } from "@/components/MobileTabBar";

// Cac muc chinh nam tren thanh tab duoi day o dien thoai (theo thu tu nay).
const PRIMARY_TABS = ["/", "/gia-pha", "/tin-nhan", "/tro-choi"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  // Kiểm tra quyền của mọi mục điều hướng SONG SONG: trước đây vòng lặp await từng
  // mục một khiến mỗi lần tải trang tốn tới ~9 vòng mạng Supabase nối tiếp chỉ để
  // dựng menu. Kết quả và thứ tự hiển thị giữ nguyên.
  const visible = (
    await Promise.all(
      NAV.map(async (item) => {
        if (!item.enabled) return null;
        if (item.roles && !item.roles.includes(session.role)) return null;
        if (item.module && !(await can(session, item.module, "view"))) return null;
        return item;
      }),
    )
  ).filter((item): item is (typeof NAV)[number] => item !== null);
  const tabs: TabItem[] = PRIMARY_TABS
    .map((href) => visible.find((i) => i.href === href))
    .filter((i): i is (typeof NAV)[number] => i !== undefined)
    .map((i) => ({ href: i.href, label: i.label }));
  return (
    <div className="min-h-dvh">
      <FamilyCoverBackdrop />
      <header className="sticky top-0 z-40 border-b border-champagne/60 bg-wine text-white shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="min-w-0 truncate text-xl font-bold">{session.familyName}</Link>
          <nav aria-label="Điều hướng chính" className="hidden flex-wrap gap-1 md:flex">
            {visible.map((item) => (
              <Link key={item.href} href={item.href}
                className="rounded-lg px-3 py-2 text-base font-medium hover:bg-wine-dark">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <form action={signOut}>
            <button className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-champagne bg-wine-dark px-4 py-2 text-base font-bold text-white shadow-sm hover:bg-ink">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              Đăng xuất
            </button>
          </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-24 md:py-8 md:pb-8">{children}</main>
      <MobileTabBar tabs={tabs} />
    </div>
  );
}
