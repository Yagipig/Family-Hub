"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcons";

export type RailItem = { href: string; label: string; badge?: number };

/**
 * Cot dieu huong ben trai theo anh mau thiet ke (31/10/2026): the trang bo tron,
 * muc dang mo to vang. Chua MOI chuyen muc nguoi dung co quyen thay (ke ca cac muc
 * khong co trong anh mau) de khong muc nao bi an. Luon hien o ca dien thoai lan may tinh.
 */
export function SideRail({ items }: { items: RailItem[] }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Chuyên mục"
      className="sticky top-16 z-30 flex max-h-[calc(100dvh-4rem)] w-[4.5rem] shrink-0 flex-col gap-2 overflow-y-auto px-1.5 py-3 [scrollbar-width:none] sm:w-24 sm:px-2 [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-center shadow-md ${
              active
                ? "bg-gradient-to-b from-[#ffe9a8] to-[#e9bc57] text-[#7c2d12]"
                : "bg-white/95 text-[#1e40af] hover:bg-white"
            }`}
          >
            <NavIcon href={item.href} />
            <span className="text-[10px] font-bold leading-tight sm:text-[11px]">{item.label}</span>
            {item.badge != null && item.badge > 0 && (
              <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white shadow">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
