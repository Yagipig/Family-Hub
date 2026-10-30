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
    <div className="min-h-dvh bg-cream">
      <FamilyCoverBackdrop />
      <header className="sticky top-0 z-50 border-b border-champagne/50 bg-wine text-white shadow-sm safe-area-top">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2.5 md:px-4 md:py-3">
          {/* Mobile-first: compact family name */}
          <Link href="/" className="min-w-0 truncate text-lg font-bold tracking-tight md:text-xl">
            {session.familyName}
          </Link>

          {/* Desktop navigation only */}
          <nav aria-label="Điều hướng chính" className="hidden flex-1 flex-wrap items-center gap-1 md:flex">
            {visible.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium transition hover:bg-wine-dark/70"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <NotificationBell className="text-white" />

            {/* Logout only visible on desktop/tablet; on phone use /them */}
            <form action={signOut} className="hidden md:block">
              <button
                className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-champagne/70 bg-wine-dark px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-ink"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
                <span className="hidden lg:inline">Đăng xuất</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main content: tighter padding on phones, comfortable on larger */}
      <main className="mx-auto max-w-5xl space-y-5 px-3 py-4 pb-20 md:space-y-6 md:px-4 md:py-6 md:pb-6">
        {children}
      </main>

      <MobileTabBar tabs={tabs} />
    </div>
  );
}
