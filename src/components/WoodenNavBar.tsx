"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcons";

export type BarItem = { href: string; label: string; icon: string; search?: boolean };

/**
 * Thanh dieu huong duoi day bang GO theo anh mau thiet ke (31/10/2026):
 * Xem Cay / Dong Toc / Su Kien / Album / Tim Kiem. Muc dang mo noi o xanh duong.
 * Hien o moi kich thuoc man hinh nhu trong anh.
 */
export function WoodenNavBar({ items }: { items: BarItem[] }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 border-t-4 border-[#6f4423] bg-gradient-to-b from-[#a9743f] to-[#7c4f24] pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(42,26,26,0.25)]"
    >
      <ul className="mx-auto grid max-w-2xl grid-flow-col px-2">
        {items.map((item) => {
          const active = !item.search && (pathname === item.href || pathname.startsWith(item.href + "/"));
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-14 items-center justify-center px-1 py-1.5"
              >
                <span
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1 text-[11px] leading-tight sm:text-xs ${
                    active ? "bg-sky-500 font-bold text-white shadow-md" : "font-medium text-[#ffe9c9]"
                  }`}
                >
                  {item.search ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.8-3.8" />
                    </svg>
                  ) : (
                    <NavIcon href={item.icon} />
                  )}
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
