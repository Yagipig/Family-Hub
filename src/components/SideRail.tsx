"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcons";

export type RailItem = { href: string; label: string; badge?: number };

/**
 * Cot dieu huong ben trai theo anh mau thiet ke (31/10/2026): nen GO SAM, moi muc la
 * mot BIEN GO khac vang, muc dang mo la bien vang sang. Chua MOI chuyen muc nguoi dung
 * co quyen thay (ke ca cac muc khong co trong anh mau) de khong muc nao bi an.
 * Luon hien o ca dien thoai lan may tinh.
 */
export function SideRail({ items }: { items: RailItem[] }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Chuyên mục"
      className="sticky top-16 z-30 flex max-h-[calc(100dvh-4rem)] min-h-[calc(100dvh-4rem)] w-[4.5rem] shrink-0 flex-col gap-2 overflow-y-auto border-r border-[#ffd97a]/25 bg-gradient-to-b from-[#43301b]/95 to-[#2a1a0c]/95 px-1.5 py-3 backdrop-blur [scrollbar-width:none] sm:w-24 sm:px-2 [&::-webkit-scrollbar]:hidden"
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
                ? "bg-gradient-to-b from-[#ffe9a8] to-[#e9bc57] text-[#7c2d12] shadow-[inset_0_0_0_1px_rgba(124,45,18,0.35),0_4px_8px_rgba(0,0,0,0.4)]"
                : "bg-gradient-to-b from-[#8a5a2b] to-[#654321] text-[#ffe9a8] shadow-[inset_0_0_0_1px_rgba(255,217,122,0.35),0_4px_6px_rgba(0,0,0,0.35)] hover:from-[#9c6a33] hover:to-[#75502a]"
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
