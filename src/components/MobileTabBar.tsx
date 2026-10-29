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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-champagne bg-ivory/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(42,26,26,0.08)] backdrop-blur md:hidden"
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
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] leading-tight ${
                  active ? "font-bold text-wine" : "font-medium text-ink-soft"
                }`}
              >
                <NavIcon href={item.href} className={active ? "text-wine" : "text-ink-soft"} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
