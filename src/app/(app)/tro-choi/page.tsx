import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { gamesAccess, REASON_LABELS } from "@/lib/games/server";
import { resolveCoin } from "@/lib/coins";
import { Alert, Card, buttonClass, buttonGhostClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { GamesBanner } from "@/components/GamesBanner";
import { claimDailyGift } from "./actions";

export const metadata = { title: "Trò chơi gia đình" };

const TILES = [
  { href: "/tro-choi/li-xi-may-man", title: "Lì xì may mắn", desc: "Bốc thăm bao lì xì ảo, mỗi người một lần." },
  { href: "/tro-choi/xo-so", title: "Xổ số gia đình", desc: "Nhận vé vui, chờ giờ quay số công khai." },
  { href: "/tro-choi/lo-to", title: "Lô tô", desc: "Nhận tờ lô tô, nghe hô số và hô “Kinh!”." },
  { href: "/tro-choi/bau-cua", title: "Bầu cua tôm cá", desc: "Đặt vài điểm vui, lắc xúc xắc cùng cả nhà." },
];

export default async function GamesHome({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireSession();
  const { ok, error } = await searchParams;
  const access = await gamesAccess(session);

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Trò chơi gia đình</h1>
      <GamesBanner coinName={resolveCoin(access.settings).name} />
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      {access.state === "no_access" && (
        <Card><p className="text-lg">Tài khoản khách không tham gia trò chơi. Nếu bạn là người nhà, hãy nhờ quản trị cấp lại quyền.</p></Card>
      )}

      {access.state === "off" && (
        <Card className="space-y-3">
          <p className="text-lg">Trò chơi đang <strong>tạm tắt</strong>. Quản trị sẽ bật lên khi gia đình có dịp vui, ví dụ ngày Tết.</p>
          {access.isAdmin && <Link href="/admin/tro-choi" className={buttonClass}>Mở trang quản trị trò chơi</Link>}
        </Card>
      )}

      {access.state === "ok" && <Home session={session} settings={access.settings} isAdmin={access.isAdmin} />}
    </>
  );
}

async function Home({ session, settings, isAdmin }: {
  session: Awaited<ReturnType<typeof requireSession>>;
  settings: NonNullable<Awaited<ReturnType<typeof gamesAccess>>["settings"]>;
  isAdmin: boolean;
}) {
  const supabase = await createClient();
  const coin = resolveCoin(settings);
  const coinLower = coin.name.toLocaleLowerCase("vi-VN");
  const { data: balance } = await supabase.rpc("points_my_balance", { p_family: session.familyId });
  const [{ data: board }, { data: history }] = await Promise.all([
    settings.leaderboard_enabled
      ? supabase.rpc("games_leaderboard", { p_family: session.familyId })
      : Promise.resolve({ data: null }),
    supabase.from("points_ledger").select("id, delta, reason, created_at").eq("user_id", session.userId)
      .order("id", { ascending: false }).limit(6),
  ]);
  const rows = (board ?? []) as Array<{ user_id: string; display_name: string; balance: number; rnk: number }>;
  const hist = (history ?? []) as Array<{ id: number; delta: number; reason: string; created_at: string }>;

  return (
    <>
      <Card className="space-y-4">
        <p className="text-base text-ink-soft">{coin.name} của bạn</p>
        <p className="text-5xl font-bold text-wine" aria-live="polite">{typeof balance === "number" ? balance : "—"} <span className="text-2xl">{coin.icon ? `${coin.icon} ` : ""}{coinLower}</span></p>
        {settings.daily_gift > 0 && (
          <form action={claimDailyGift} className="flex flex-wrap items-center gap-3">
            <SubmitButton>Nhận quà hằng ngày (+{settings.daily_gift} {coinLower})</SubmitButton>
            <span className="text-sm text-ink-soft">Mỗi ngày nhận một lần, tính theo ngày ở nơi bạn đang sống.</span>
          </form>
        )}
      </Card>

      <nav aria-label="Chọn trò chơi" className="grid gap-4 sm:grid-cols-2">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href}
            className="block min-h-28 rounded-2xl border-2 border-champagne bg-ivory p-5 hover:border-wine hover:bg-champagne-soft">
            <span className="block text-2xl font-bold text-wine">{t.title}</span>
            <span className="mt-1 block text-base text-ink-soft">{t.href === "/tro-choi/bau-cua" ? `Đặt vài ${coinLower} vui, lắc xúc xắc cùng cả nhà.` : t.desc}</span>
          </Link>
        ))}
      </nav>

      {settings.leaderboard_enabled && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Bảng {coinLower} gia đình</h2>
          {rows.length === 0 ? <p className="text-base text-ink-soft">Chưa có ai trong bảng {coinLower}.</p> : (
            <ol className="space-y-1 text-lg">
              {rows.slice(0, 10).map((r) => (
                <li key={r.user_id} className={r.user_id === session.userId ? "font-bold text-wine" : ""}>
                  {r.rnk}. {r.display_name} — {r.balance} {coinLower}
                </li>
              ))}
            </ol>
          )}
          <Link href="/tro-choi/tv/bang-diem" className={buttonGhostClass}>Chiếu bảng {coinLower} lên TV</Link>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Lịch sử {coinLower} gần đây</h2>
        {hist.length === 0 ? <p className="text-base text-ink-soft">Chưa có thay đổi nào.</p> : (
          <ul className="divide-y divide-champagne/50 text-base">
            {hist.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{REASON_LABELS[h.reason] ?? h.reason} <span className="text-sm text-ink-soft">· {formatDateTime(h.created_at, session.timezone)}</span></span>
                <strong className={h.delta > 0 ? "text-ok" : "text-danger"}>{h.delta > 0 ? "+" : ""}{h.delta}</strong>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isAdmin && <Link href="/admin/tro-choi" className={buttonGhostClass}>Quản trị trò chơi</Link>}
    </>
  );
}
