import Link from "next/link";
import { can, requireSession } from "@/lib/auth";
import { NAV } from "@/lib/nav";
import { signOut } from "@/app/actions/auth";
import { Card, buttonClass } from "@/components/ui";
import { NavTile } from "@/components/NavIcons";

export const metadata = { title: "Thêm" };

// Trang "Them": liet ke TOAN BO muc dieu huong dang duoc thay (gom ca cac muc
// khong nam tren thanh tab duoi day) duoi dang luoi o bieu tuong, kem nut Dang xuat.
// La noi nguoi dung dien thoai tim cac muc nhu Thanh vien, Album, Cai dat, Quan tri...

export default async function MorePage() {
  const session = await requireSession();
  const visible = (
    await Promise.all(
      NAV.map(async (item) => {
        if (!item.enabled || item.href === "/") return null;
        if (item.roles && !item.roles.includes(session.role)) return null;
        if (item.module && !(await can(session, item.module, "view"))) return null;
        return item;
      }),
    )
  ).filter((item): item is (typeof NAV)[number] => item !== null);

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Thêm</h1>
      <section aria-label="Tất cả chuyên mục" className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {visible.map((item) => (
          <Link key={item.href} href={item.href} className="block focus-visible:outline-none">
            <Card className="flex h-full flex-col items-center gap-2 py-5 text-center hover:border-wine">
              <NavTile href={item.href} />
              <span className="text-base font-bold text-wine">{item.label}</span>
            </Card>
          </Link>
        ))}
      </section>
      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Tài khoản</h2>
        <p className="text-base text-ink-soft">
          {session.displayName} · {session.email}
        </p>
        <form action={signOut}>
          <button className={buttonClass}>Đăng xuất</button>
        </form>
      </Card>
    </>
  );
}
