"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcons";

export type RailItem = { href: string; label: string; badge?: number };

/**
 * Cot dieu huong ben trai theo anh mau thiet ke (31/10/2026): THE SANG icon XANH nhu anh,
 * muc dang mo to vang kim; kich thuoc THU NHO cho vua dien thoai (nguoi dung gop y chu/icon
 * qua to bi de). Chua MOI chuyen muc nguoi dung co quyen thay (ke ca cac muc khong co
 * trong anh mau) de khong muc nao bi an. Luon hien o ca dien thoai lan may tinh.
 */
export function SideRail({ items }: { items: RailItem[] }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Chuyên mục"
      className="sticky top-12 z-30 flex max-h-[calc(100dvh-3rem)] min-h-[calc(100dvh-3rem)] w-12 shrink-0 flex-col gap-1.5 overflow-y-auto bg-[#fffbf0]/85 px-1 py-2 backdrop-blur [scrollbar-width:none] sm:top-14 sm:max-h-[calc(100dvh-3.5rem)] sm:min-h-[calc(100dvh-3.5rem)] sm:w-[4.25rem] sm:px-1.5 [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-center shadow-sm sm:py-2 ${
              active
                ? "bg-gradient-to-b from-[#ffe9a8] to-[#e9bc57] text-[#7c2d12]"
                : "bg-white text-[#1e3a5f] hover:bg-[#fff7dd]"
            }`}
          >
            <NavIcon href={item.href} className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
            <span className="text-[9px] font-bold leading-[1.05] sm:text-[9.5px]">{item.label}</span>
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
