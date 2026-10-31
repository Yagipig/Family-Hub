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
      className="fixed inset-x-0 bottom-0 z-40 border-t-4 border-[#6f4423] bg-gradient-to-b from-[#a9743f] to-[#7c4f24] pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(42,26,26,0.25)] md:hidden"
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
                className="flex min-h-14 items-center justify-center px-1 py-1.5"
              >
                <span
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1 text-[11px] leading-tight ${
                    active ? "bg-sky-500 font-bold text-white shadow-md" : "font-medium text-[#ffe9c9]"
                  }`}
                >
                  <NavIcon href={item.href} />
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
