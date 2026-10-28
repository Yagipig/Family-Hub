import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { gamesAccess, profileNames } from "@/lib/games/server";
import { verifyLottery } from "@/lib/games/fair";
import { Alert, Card, buttonGhostClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { GamesBanner } from "@/components/GamesBanner";
import { GamesAutoRefresh } from "@/components/GamesAutoRefresh";
import { Countdown } from "@/components/Countdown";
import { getTicket, runLottery } from "./actions";

export const metadata = { title: "Xổ số gia đình" };

type Draw = {
  id: string; title: string; status: "open" | "drawn" | "cancelled"; ticket_price: number; free_tickets: number;
  max_tickets: number; draw_at: string; commit_hash: string; ticket_count: number; created_at: string;
};
type Prize = { draw_id: string; rank: number; kind: string; label: string; points: number | null };
type Ticket = { draw_id: string; user_id: string; ticket_no: number };
type Result = { draw_id: string; rank: number; label: string; ticket_no: number; user_id: string; points_awarded: number };

export default async function LotteryPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireSession();
  const { ok, error } = await searchParams;
  const access = await gamesAccess(session);
  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Xổ số gia đình</h1>
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
  const load = async () => {
    const { data } = await supabase.from("lottery_draws")
      .select("id, title, status, ticket_price, free_tickets, max_tickets, draw_at, commit_hash, ticket_count, created_at")
      .order("created_at", { ascending: false }).limit(6);
    return (data ?? []) as Draw[];
  };
  let draws = await load();
  // Toi gio quay thi tu quay (idempotent, CSDL khoa va kiem tra); loi (vi du da co nguoi quay truoc) thi bo qua
  const due = draws.filter((d) => d.status === "open" && new Date(d.draw_at).getTime() <= Date.now());
  if (due.length) {
    await Promise.all(due.map((d) => supabase.rpc("lottery_run", { p_draw: d.id })));
    draws = await load();
  }
  const ids = draws.map((d) => d.id);
  const [{ data: pz }, { data: tk }, { data: rs }, { data: sd }] = ids.length
    ? await Promise.all([
        supabase.from("lottery_prizes").select("draw_id, rank, kind, label, points").in("draw_id", ids).order("rank"),
        supabase.from("lottery_tickets").select("draw_id, user_id, ticket_no").in("draw_id", ids).order("ticket_no"),
        supabase.from("lottery_results").select("draw_id, rank, label, ticket_no, user_id, points_awarded").in("draw_id", ids).order("rank"),
        supabase.from("game_seeds").select("ref_id, seed").eq("kind", "lottery").in("ref_id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const prizes = (pz ?? []) as Prize[];
  const tickets = (tk ?? []) as Ticket[];
  const results = (rs ?? []) as Result[];
  const seeds = new Map(((sd ?? []) as Array<{ ref_id: string; seed: string }>).map((s) => [s.ref_id, s.seed]));
  const names = await profileNames([...results.map((r) => r.user_id), ...tickets.map((t) => t.user_id)]);
  const anyOpen = draws.some((d) => d.status === "open");
  const now = Date.now();

  return (
    <>
      <GamesAutoRefresh seconds={6} active={anyOpen} />
      {draws.length === 0 && <Card><p className="text-lg">Chưa có kỳ quay số nào. Khi quản trị mở kỳ mới, bạn sẽ nhận được thông báo.</p></Card>}
      {draws.map((d) => {
        const myTickets = tickets.filter((t) => t.draw_id === d.id && t.user_id === session.userId);
        const dPrizes = prizes.filter((p) => p.draw_id === d.id);
        const dResults = results.filter((r) => r.draw_id === d.id);
        const due = new Date(d.draw_at).getTime() <= now;
        const nextPaid = myTickets.length >= d.free_tickets;
        const seed = seeds.get(d.id);
        const verify = d.status === "drawn" && seed
          ? verifyLottery({
              commit: d.commit_hash, seed, prizeCount: dPrizes.length,
              tickets: tickets.filter((t) => t.draw_id === d.id).map((t) => ({ no: t.ticket_no, owner: t.user_id })),
              winnersByRank: dResults.map((r) => r.ticket_no),
            })
          : null;
        return (
          <Card key={d.id} className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-bold">{d.title}</h2>
              <span className="text-base font-semibold text-wine">
                {d.status === "open" ? "Đang nhận vé" : d.status === "drawn" ? "Đã quay số" : "Đã hủy"}
              </span>
            </div>
            <p className="text-base">
              Giờ quay: <strong>{formatDateTime(d.draw_at, session.timezone)}</strong>
              {d.status === "open" && <> · còn <strong><Countdown to={d.draw_at} /></strong></>}
            </p>
            <ul className="text-base">
              {dPrizes.map((p) => (
                <li key={p.rank}>Giải {p.rank}: {p.label}{p.kind === "points" ? ` (${p.points} điểm vui)` : ""}</li>
              ))}
            </ul>
            <p className="text-base text-ink-soft">
              Vé đầu tiên miễn phí ({d.free_tickets} vé), các vé sau {d.ticket_price} điểm vui/vé, tối đa {d.max_tickets} vé mỗi người. Đã phát {d.ticket_count} vé.
            </p>

            {d.status === "open" && (
              <>
                <p className="text-lg">
                  Vé của bạn: {myTickets.length ? <strong>{myTickets.map((t) => `#${t.ticket_no}`).join(", ")}</strong> : "chưa có"}
                </p>
                <div className="flex flex-wrap gap-3">
                  {!due && myTickets.length < d.max_tickets && (
                    <form action={getTicket}>
                      <input type="hidden" name="id" value={d.id} />
                      <SubmitButton>{nextPaid && d.ticket_price > 0 ? `Đổi ${d.ticket_price} điểm lấy 1 vé` : "Nhận vé miễn phí"}</SubmitButton>
                    </form>
                  )}
                  {(due || isAdmin) && (
                    <form action={runLottery}>
                      <input type="hidden" name="id" value={d.id} />
                      <SubmitButton pendingText="Đang quay…">{due ? "Đã đến giờ — Quay số" : "Quản trị: quay số ngay"}</SubmitButton>
                    </form>
                  )}
                  <Link href={`/tro-choi/tv/${d.id}`} className={buttonGhostClass}>Chiếu lên TV</Link>
                </div>
              </>
            )}

            {d.status === "drawn" && (
              <>
                <h3 className="text-xl font-bold">Kết quả</h3>
                <ol className="space-y-1 text-lg">
                  {dResults.map((r) => (
                    <li key={r.rank} className={r.user_id === session.userId ? "font-bold text-wine" : ""}>
                      Giải {r.rank} ({r.label}): vé #{r.ticket_no} — {names.get(r.user_id) ?? "Thành viên"}
                      {r.points_awarded > 0 ? ` · +${r.points_awarded} điểm` : ""}
                    </li>
                  ))}
                  {dResults.length === 0 && <li>Không có vé nào nên chưa trao giải.</li>}
                </ol>
                <Link href={`/tro-choi/tv/${d.id}`} className={buttonGhostClass}>Chiếu kết quả lên TV</Link>
              </>
            )}

            <details className="text-sm">
              <summary className="min-h-12 cursor-pointer py-2 text-base font-semibold">Kiểm chứng công bằng (cam kết – tiết lộ)</summary>
              <div className="space-y-2 pb-2 text-ink-soft">
                <p>Trước khi quay, hệ thống đã công bố mã cam kết = SHA-256 của một chuỗi bí mật (seed). Sau khi quay, seed được tiết lộ; ai cũng tính lại được kết quả.</p>
                <p className="break-all"><strong>Mã cam kết:</strong> <code>{d.commit_hash}</code></p>
                {seed ? <p className="break-all"><strong>Seed:</strong> <code>{seed}</code></p> : <p>Seed sẽ được công bố sau khi quay.</p>}
                {verify && (
                  <p className={verify.ok ? "font-semibold text-ok" : "font-semibold text-danger"}>
                    {verify.ok ? "Đã tự kiểm chứng: seed khớp mã cam kết và kết quả khớp thuật toán công khai." : verify.problems.join(" ")}
                  </p>
                )}
              </div>
            </details>
          </Card>
        );
      })}
    </>
  );
}
