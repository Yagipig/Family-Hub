import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { gamesAccess, profileNames } from "@/lib/games/server";
import { Alert, Card, buttonClass, buttonGhostClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { GamesBanner } from "@/components/GamesBanner";
import { GamesAutoRefresh } from "@/components/GamesAutoRefresh";
import { drawLixi } from "./actions";

export const metadata = { title: "Lì xì may mắn" };

type Packet = { id: string; title: string; status: string; prize_count: number; closes_at: string | null; created_at: string };
type Draw = { packet_id: string; user_id: string; points: number };

export default async function LixiPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireSession();
  const { ok, error } = await searchParams;
  const access = await gamesAccess(session);

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Lì xì may mắn</h1>
      <GamesBanner />
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {access.state !== "ok" ? (
        <Card className="space-y-3">
          <p className="text-lg">{access.state === "off" ? "Trò chơi đang tạm tắt." : "Tài khoản khách không tham gia trò chơi."}</p>
          <Link href="/tro-choi" className={buttonGhostClass}>Về trang trò chơi</Link>
        </Card>
      ) : (
        <Body session={session} isAdmin={access.isAdmin} />
      )}
    </>
  );
}

async function Body({ session, isAdmin }: { session: Awaited<ReturnType<typeof requireSession>>; isAdmin: boolean }) {
  const supabase = await createClient();
  const [{ data: pk }, { data: dr }] = await Promise.all([
    supabase.from("lixi_packets").select("id, title, status, prize_count, closes_at, created_at").order("created_at", { ascending: false }).limit(10),
    supabase.from("lixi_draws").select("packet_id, user_id, points").order("created_at", { ascending: false }).limit(500),
  ]);
  const packets = (pk ?? []) as Packet[];
  const draws = (dr ?? []) as Draw[];
  const names = await profileNames(draws.map((d) => d.user_id));
  const now = Date.now();
  const anyOpen = packets.some((p) => p.status === "open");

  return (
    <>
      <GamesAutoRefresh seconds={8} active={anyOpen} />
      {packets.length === 0 && (
        <Card className="space-y-3">
          <p className="text-lg">Chưa có bao lì xì nào. Khi quản trị tạo bao mới, bạn sẽ nhận được thông báo.</p>
          {isAdmin && <Link href="/admin/tro-choi" className={buttonClass}>Tạo bao lì xì</Link>}
        </Card>
      )}
      {packets.map((p) => {
        const mine = draws.find((d) => d.packet_id === p.id && d.user_id === session.userId);
        const list = draws.filter((d) => d.packet_id === p.id);
        const left = p.prize_count - list.length;
        const expired = p.closes_at !== null && new Date(p.closes_at).getTime() <= now;
        const open = p.status === "open" && !expired && left > 0;
        return (
          <Card key={p.id} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-bold">{p.title}</h2>
              <span className="text-base font-semibold text-wine">
                {open ? `Còn ${left}/${p.prize_count} bao` : "Đã đóng"}
              </span>
            </div>
            {p.closes_at && open && <p className="text-sm text-ink-soft">Đóng lúc {formatDateTime(p.closes_at, session.timezone)}</p>}
            {mine ? (
              <p className="rounded-xl bg-champagne-soft px-4 py-3 text-xl font-bold text-wine-dark">Bạn đã bốc được {mine.points} điểm vui</p>
            ) : open ? (
              <form action={drawLixi}>
                <input type="hidden" name="id" value={p.id} />
                <SubmitButton pendingText="Đang bốc…">Bốc lì xì</SubmitButton>
              </form>
            ) : (
              <p className="text-base text-ink-soft">Bao này đã đóng, bạn chưa kịp bốc. Hẹn bao sau nhé!</p>
            )}
            {list.length > 0 && (
              <details className="text-base">
                <summary className="min-h-12 cursor-pointer py-2 font-semibold">Ai đã bốc ({list.length})</summary>
                <ul className="space-y-1 pb-2">
                  {list.map((d) => <li key={d.user_id}>{names.get(d.user_id) ?? "Thành viên"} — {d.points} điểm</li>)}
                </ul>
              </details>
            )}
          </Card>
        );
      })}
    </>
  );
}
