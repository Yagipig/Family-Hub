import Link from "next/link";
import { can, requireSession } from "@/lib/auth";
import { NAV } from "@/lib/nav";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { NotificationBell } from "@/components/NotificationBell";
import { FamilyCoverBackdrop } from "@/components/FamilyCover";
import { NavIcon } from "@/components/NavIcons";
import { SideRail, type RailItem } from "@/components/SideRail";
import { WoodenNavBar, type BarItem } from "@/components/WoodenNavBar";

// Khung giao dien theo anh mau nguoi dung chot 31/10/2026 (chinh lai 22:58 cung ngay:
// bo xanh duong tu them, doi sang go sam khac vang nhu trong anh):
// - Thanh tren GO SAM khac vang: logo cay vang + ten dong ho + khau hieu + tim kiem/chuong/menu/anh dai dien.
// - Cot trai: MOI chuyen muc dang thay dang the bo tron (muc dang mo to vang), ke ca cac muc
//   khong co trong anh mau (Thiep, Li xi, Bang tin, Tro choi, Quan tri...) de khong muc nao bi an.
// - Thanh duoi bang go: Xem Cay / Dong Toc / Su Kien / Album / Tim Kiem.
const RAIL_LABEL: Record<string, string> = {
  "/thanh-vien": "Thành Viên",
  "/lich": "Sự Kiện",
  "/album": "Album Ảnh",
  "/tin-nhan": "Tin Nhắn",
  "/cai-dat": "Cài Đặt",
  "/thiep": "Thiệp",
  "/bang-tin": "Bảng Tin",
};

const iconBtn =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-white hover:bg-white/15";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  // Kiểm tra quyền của mọi mục điều hướng SONG SONG (tránh ~9 vòng mạng Supabase nối tiếp).
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
  const has = (href: string) => visible.some((i) => i.href === href);

  // Cột trái: Cây Gia Phả lên đầu (mở app là cây), rồi mọi mục còn lại theo thứ tự NAV.
  const rail: RailItem[] = [];
  if (has("/gia-pha")) rail.push({ href: "/gia-pha", label: "Cây Gia Phả" });
  for (const item of visible) {
    if (item.href === "/" || item.href === "/gia-pha") continue;
    rail.push({ href: item.href, label: RAIL_LABEL[item.href] ?? item.label });
  }
  // Huy hiệu số tin nhắn chưa đọc trên mục Tin Nhắn (như ảnh mẫu)
  if (has("/tin-nhan")) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.from("chat_conversations_v").select("unread_count, muted");
      const unread = (data ?? []).reduce(
        (n, r) => n + (r.muted ? 0 : ((r.unread_count as number | null) ?? 0)),
        0,
      );
      const chatItem = rail.find((r) => r.href === "/tin-nhan");
      if (chatItem && unread > 0) chatItem.badge = unread;
    } catch {
      // Không đọc được số chưa đọc thì thôi, cột vẫn hiện bình thường.
    }
  }

  // Thanh gỗ dưới đáy theo đúng 5 mục trong ảnh mẫu (chỉ hiện mục có quyền xem)
  const bar: BarItem[] = [];
  if (has("/gia-pha")) bar.push({ href: "/gia-pha", label: "Xem Cây", icon: "/gia-pha" });
  if (has("/thanh-vien")) bar.push({ href: "/thanh-vien", label: "Dòng Tộc", icon: "/thanh-vien" });
  if (has("/lich")) bar.push({ href: "/lich", label: "Sự Kiện", icon: "/lich" });
  if (has("/album")) bar.push({ href: "/album", label: "Album", icon: "/album" });
  if (has("/thanh-vien")) bar.push({ href: "/thanh-vien", label: "Tìm Kiếm", icon: "/thanh-vien", search: true });

  return (
    <div className="flex min-h-dvh flex-col">
      <FamilyCoverBackdrop />
      <header className="sticky top-0 z-40 border-b-2 border-[#c9932f]/70 bg-gradient-to-r from-[#4a2e15] via-[#5d3d1e] to-[#3a2410] text-white shadow-md">
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link href="/gia-pha" className="flex min-w-0 items-center gap-2" aria-label="Về cây gia phả">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#ffe9a8] to-[#e9bc57] text-[#6b4218] shadow" aria-hidden="true">
              <NavIcon href="/gia-pha" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold leading-tight text-[#ffd97a] sm:text-xl">{session.familyName}</span>
              <span className="block text-[11px] leading-tight text-white/85 md:hidden">Gìn giữ cội nguồn · Kết nối yêu thương</span>
            </span>
          </Link>
          <p className="mx-auto hidden items-center gap-2 whitespace-nowrap text-base italic text-white/95 lg:block">
            Gìn giữ cội nguồn <span aria-hidden="true" className="not-italic">❤️</span> Kết nối yêu thương
          </p>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-0">
            <Link href="/thanh-vien" aria-label="Tìm kiếm thành viên" className={iconBtn}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.8-3.8" />
              </svg>
            </Link>
            <NotificationBell />
            <Link href="/them" aria-label="Tất cả chuyên mục và đăng xuất" className={iconBtn}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </Link>
            <Link href="/cai-dat" aria-label="Tài khoản của tôi" className="shrink-0">
              <Avatar name={session.displayName} size={40} className="border-2 border-white/70" />
            </Link>
          </div>
        </div>
      </header>
      <div className="flex flex-1 items-start">
        <SideRail items={rail} />
        <main className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 space-y-6 px-3 py-5 pb-28 sm:px-4">{children}</main>
      </div>
      <WoodenNavBar items={bar} />
    </div>
  );
}
