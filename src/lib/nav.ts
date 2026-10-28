import type { Role } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  /** Mục chỉ hiện khi có quyền xem module tương ứng (kiểm tra thật ở máy chủ/RLS). */
  module?: string;
  /** Vai trò được thấy mục này (dùng cho mục quản trị). */
  roles?: Role[];
  /** false = module chưa xây (giai đoạn sau): không hiển thị, tránh liên kết chết. */
  enabled: boolean;
};

export const NAV: NavItem[] = [
  { href: "/", label: "Trang chủ", enabled: true },
  { href: "/gia-pha", label: "Gia phả", module: "tree", enabled: true },
  { href: "/thanh-vien", label: "Thành viên", module: "members", enabled: true },
  { href: "/tin-nhan", label: "Tin nhắn", module: "chat", enabled: true },
  { href: "/lich", label: "Sinh nhật và sự kiện", module: "events", enabled: true },
  { href: "/thiep", label: "Thiệp và lì xì", module: "cards", enabled: true },
  { href: "/li-xi", label: "Lì xì", module: "gifts", enabled: true },
  { href: "/bang-tin", label: "Bảng tin", module: "posts", enabled: true },
  { href: "/album", label: "Album gia đình", module: "posts", enabled: true },
  { href: "/tro-choi", label: "Trò chơi", module: "games", enabled: true },
  { href: "/cai-dat", label: "Cài đặt", enabled: true },
  { href: "/admin", label: "Quản trị", roles: ["super_admin", "family_admin", "branch_admin"], enabled: true },
];
