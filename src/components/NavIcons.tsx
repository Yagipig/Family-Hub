// Bo bieu tuong dieu huong dung chung: thanh tab duoi day, trang Them, loi tat trang chu.
// SVG net ve (phong cach lucide), kich thuoc mac dinh 24.

type P = { className?: string };

function base(props: P) {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: props.className,
  };
}

export function HomeIcon(p: P) {
  return (<svg {...base(p)}><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>);
}
export function TreeIcon(p: P) {
  return (<svg {...base(p)}><circle cx="12" cy="4.5" r="2.2" /><circle cx="5" cy="19.5" r="2.2" /><circle cx="19" cy="19.5" r="2.2" /><path d="M12 6.7v4.3" /><path d="M12 11c0 3-3.5 3.4-4.8 6" /><path d="M12 11c0 3 3.5 3.4 4.8 6" /></svg>);
}
export function UsersIcon(p: P) {
  return (<svg {...base(p)}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><path d="M16 5.4a3.2 3.2 0 0 1 0 5.9" /><path d="M17.5 15.4c1.7.6 2.7 2 3 4.1" /></svg>);
}
export function ChatIcon(p: P) {
  return (<svg {...base(p)}><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1.1L3 20l1.1-5.3A8.5 8.5 0 1 1 21 11.5z" /></svg>);
}
export function CalendarIcon(p: P) {
  return (<svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>);
}
export function MailIcon(p: P) {
  return (<svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>);
}
export function GiftIcon(p: P) {
  return (<svg {...base(p)}><rect x="3" y="8" width="18" height="4" /><path d="M5 12v9h14v-9" /><path d="M12 8v13" /><path d="M12 8c-4.5 0-5-4.5-2.5-5C12 2.6 12 8 12 8z" /><path d="M12 8c4.5 0 5-4.5 2.5-5C12 2.6 12 8 12 8z" /></svg>);
}
export function NewsIcon(p: P) {
  return (<svg {...base(p)}><path d="M4 5h13v14H6a2 2 0 0 1-2-2z" /><path d="M17 8h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2" /><path d="M7 9h7M7 13h7M7 17h4" /></svg>);
}
export function AlbumIcon(p: P) {
  return (<svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-4.5-4.5L6 21" /></svg>);
}
export function GameIcon(p: P) {
  return (<svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="8.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /></svg>);
}
export function SettingsIcon(p: P) {
  return (<svg {...base(p)}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" /></svg>);
}
export function ShieldIcon(p: P) {
  return (<svg {...base(p)}><path d="M12 3 5 5.8v5.4c0 4.5 3 7.6 7 9.3 4-1.7 7-4.8 7-9.3V5.8z" /><path d="m9 11.5 2.2 2.2L15.5 9.4" /></svg>);
}
export function GridIcon(p: P) {
  return (<svg {...base(p)}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>);
}
export function BellIcon(p: P) {
  return (<svg {...base(p)}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M10 21a2.2 2.2 0 0 0 4 0" /></svg>);
}

// Ô biểu tượng "vui" cho lối tắt trang chủ + trang Thêm (người dùng yêu cầu 31/10/2026):
// mỗi chuyên mục một màu chuyển sắc riêng, biểu tượng trắng nổi trên ô bo tròn có bóng đổ.
const NAV_TILE_GRADIENT: Record<string, string> = {
  "/": "from-amber-400 to-orange-500",
  "/gia-pha": "from-emerald-400 to-teal-600",
  "/thanh-vien": "from-sky-400 to-blue-600",
  "/tin-nhan": "from-blue-400 to-indigo-500",
  "/lich": "from-rose-400 to-pink-600",
  "/thiep": "from-fuchsia-400 to-purple-500",
  "/li-xi": "from-red-400 to-rose-600",
  "/bang-tin": "from-cyan-400 to-sky-600",
  "/album": "from-violet-400 to-purple-600",
  "/tro-choi": "from-lime-500 to-green-600",
  "/cai-dat": "from-slate-400 to-slate-600",
  "/admin": "from-yellow-400 to-amber-600",
  "/them": "from-orange-400 to-red-500",
};

export function NavTile({ href }: { href: string }) {
  const gradient = NAV_TILE_GRADIENT[href] ?? "from-amber-400 to-orange-500";
  return (
    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${gradient}`}>
      <NavIcon href={href} />
    </span>
  );
}

export function NavIcon({ href, className }: { href: string; className?: string }) {
  const p = { className };
  switch (href) {
    case "/": return <HomeIcon {...p} />;
    case "/gia-pha": return <TreeIcon {...p} />;
    case "/thanh-vien": return <UsersIcon {...p} />;
    case "/tin-nhan": return <ChatIcon {...p} />;
    case "/lich": return <CalendarIcon {...p} />;
    case "/thiep": return <MailIcon {...p} />;
    case "/li-xi": return <GiftIcon {...p} />;
    case "/bang-tin": return <NewsIcon {...p} />;
    case "/album": return <AlbumIcon {...p} />;
    case "/tro-choi": return <GameIcon {...p} />;
    case "/cai-dat": return <SettingsIcon {...p} />;
    case "/admin": return <ShieldIcon {...p} />;
    case "/them": return <GridIcon {...p} />;
    default: return <GridIcon {...p} />;
  }
}
