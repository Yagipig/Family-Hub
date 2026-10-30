"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcons";

// Thanh dieu huong DUOI DAY man hinh cho dien thoai (kieu ung dung that).
// Desktop (md tro len) khong hien — da co menu tren dau trang nhu cu.
// "Them" dan toi trang /them liet ke toan bo muc con lai + nut Dang xuat.

export type TabItem = { href: string; label: string };

export function MobileTabBar({ tabs }: { tabs: TabItem[] }) {
  const pathname = usePathname() ?? "/";
  const items: TabItem[] = [...tabs, { href: "/them", label: "Thêm" }];
  const primaryActive = tabs.some(
    (t) => pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href + "/")),
  );
  return (
    <nav
      aria-label="Điều hướng dưới đáy"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-champagne/70 bg-ivory/98 pb-[env(safe-area-inset-bottom)] shadow-[0_-3px_16px_rgba(42,26,26,0.1)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-flow-col">
        {items.map((item) => {
          const active =
            item.href === "/them"
              ? pathname === "/them" || !primaryActive
              : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[10.5px] font-medium leading-none transition-colors active:scale-[0.96] ${
                  active ? "font-semibold text-wine" : "text-ink-soft active:text-ink"
                }`}
              >
                <span className={`flex h-6 w-6 items-center justify-center transition-transform ${active ? "scale-110" : ""}`}>
                  <NavIcon href={item.href} className={active ? "text-wine" : "text-ink-soft"} />
                </span>
                <span className="mt-0.5 tracking-[-0.1px]">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
