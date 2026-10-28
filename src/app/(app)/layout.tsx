import Link from "next/link";
import { can, requireSession } from "@/lib/auth";
import { NAV } from "@/lib/nav";
import { signOut } from "@/app/actions/auth";
import { buttonGhostClass } from "@/components/ui";
import { NotificationBell } from "@/components/NotificationBell";
import { FamilyCoverBackdrop } from "@/components/FamilyCover";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const visible = [];
  for (const item of NAV) {
    if (!item.enabled) continue;
    if (item.roles && !item.roles.includes(session.role)) continue;
    if (item.module && !(await can(session, item.module, "view"))) continue;
    visible.push(item);
  }
  return (
    <div className="min-h-dvh">
      <FamilyCoverBackdrop />
      <header className="border-b border-champagne/60 bg-wine text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="text-xl font-bold">{session.familyName}</span>
          <nav aria-label="Điều hướng chính" className="flex flex-wrap gap-1">
            {visible.map((item) => (
              <Link key={item.href} href={item.href}
                className="rounded-lg px-3 py-2 text-base font-medium hover:bg-wine-dark">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <form action={signOut}>
            <button className={`${buttonGhostClass} !min-h-10 border-champagne text-white hover:!bg-wine-dark`}>Đăng xuất</button>
          </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">{children}</main>
    </div>
  );
}
