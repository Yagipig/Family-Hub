import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { gamesAccess, profileNames } from "@/lib/games/server";
import { resolveCoin } from "@/lib/coins";
import { SYMBOLS, payout } from "@/lib/games/baucua";
import { Alert, Card, SelectField, buttonGhostClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { GamesBanner } from "@/components/GamesBanner";
import { GamesAutoRefresh } from "@/components/GamesAutoRefresh";
import { Countdown } from "@/components/Countdown";
import { newRound, placeBet, rollRound } from "./actions";

export const metadata = { title: "Bầu cua tôm cá" };

type MyState = {
  balance: number; net_today: number; locked: "loss" | "win" | null;
  limits: { min_bet: number; max_bet: number; round_total: number; loss_cap: number; win_cap: number };
  room: { id: string; title: string } | null;
  round: { id: string; no: number; status: "betting" | "rolled" | "cancelled"; closes_at: string; dice: number[] | null } | null;
  bets: Array<{ symbol: number; amount: number; payout: number | null }>;
};

export default async function BauCuaPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireSession();
  const { ok, error } = await searchParams;
  const access = await gamesAccess(session);
  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Bầu cua tôm cá</h1>
      <GamesBanner coinName={resolveCoin(access.settings).name} />
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {access.state !== "ok" ? (
        <Card className="space-y-3">
          <p className="text-lg">{access.state === "off" ? "Trò chơi đang tạm tắt." : "Tài khoản khách không tham gia trò chơi."}</p>
          <Link href="/tro-choi" className={buttonGhostClass}>Về trang trò chơi</Link>
        </Card>
      ) : (
        <Body familyId={session.familyId} isAdmin={access.isAdmin} coin={resolveCoin(access.settings)} />
      )}
    </>
  );
}

async function Body({ familyId, isAdmin, coin }: { familyId: string; isAdmin: boolean; coin: ReturnType<typeof resolveCoin> }) {
  const coinLower = coin.name.toLocaleLowerCase("vi-VN");
  const supabase = await createClient();
  let { data, error } = await supabase.rpc("bc_my_state", { p_family: familyId });
  if (error || !data) return <Alert kind="error">Không tải được trạng thái trò chơi. Vui lòng thử lại.</Alert>;
  const first = data as MyState;
  // Het gio dat cuoc thi tu lac (CSDL kiem tra gio; loi thi bo qua)
  if (first.round?.status === "betting" && new Date(first.round.closes_at).getTime() <= Date.now()) {
    await supabase.rpc("bc_roll", { p_round: first.round.id });
    ({ data, error } = await supabase.rpc("bc_my_state", { p_family: familyId }));
    if (error || !data) return <Alert kind="error">Không tải được trạng thái trò chơi. Vui lòng thử lại.</Alert>;
  }
  const st = data as MyState;
  const { room, round, limits } = st;

  if (!room) {
    return (
      <Card className="space-y-3">
        <p className="text-lg">Hiện chưa có phòng bầu cua nào đang mở. Quản trị sẽ mở phòng khi cả nhà cùng chơi.</p>
        {isAdmin && <Link href="/admin/tro-choi" className="text-lg font-semibold text-wine underline">Mở phòng ở trang quản trị</Link>}
      </Card>
    );
  }

  // Ket qua cac cuoc cua moi nguoi trong van da chot (RLS chi cho thay khi van da chot)
  let results: Array<{ user_id: string; bet: number; pay: number }> = [];
  const names = new Map<string, string>();
  if (round?.status === "rolled") {
    const { data: bets } = await supabase.from("bc_bets").select("user_id, amount, payout").eq("round_id", round.id);
    const by = new Map<string, { bet: number; pay: number }>();
    for (const b of (bets ?? []) as Array<{ user_id: string; amount: number; payout: number | null }>) {
      const cur = by.get(b.user_id) ?? { bet: 0, pay: 0 };
      cur.bet += b.amount; cur.pay += b.payout ?? 0;
      by.set(b.user_id, cur);
    }
    results = [...by.entries()].map(([user_id, v]) => ({ user_id, ...v }));
    for (const [k, v] of await profileNames(results.map((r) => r.user_id))) names.set(k, v);
  }

  const betting = round?.status === "betting";
  const closed = betting && new Date(round!.closes_at).getTime() <= Date.now();
  const myTotal = st.bets.reduce((a, b) => a + b.amount, 0);
  const budget = Math.max(0, limits.loss_cap + st.net_today);
  const amounts = Array.from({ length: limits.max_bet - limits.min_bet + 1 }, (_, i) => limits.min_bet + i).slice(0, 50);

  return (
    <>
      <GamesAutoRefresh seconds={3} />
      <Card className="space-y-2">
        <h2 className="text-2xl font-bold">{room.title}</h2>
        <p className="text-lg">{coin.name} của bạn: <strong className="text-wine">{st.balance}</strong> {coinLower}</p>
        <p className="text-base text-ink-soft">
          Mỗi ô cược từ {limits.min_bet} đến {limits.max_bet} {coinLower} · tổng mỗi ván tối đa {limits.round_total} {coinLower} ·
          hôm nay chơi tối đa thua {limits.loss_cap} {coinLower}. Hôm nay bạn đang {st.net_today >= 0 ? "hòa/lời" : "thua"} {Math.abs(st.net_today)} {coinLower}.
        </p>
        <p className="text-sm text-ink-soft">Luật cổ điển: đặt n {coinLower} vào một ô, ô đó ra k lần thì nhận lại n + k × n {coinLower}; không ra thì mất n.</p>
      </Card>

      {st.locked && (
        <Alert kind="ok">
          {st.locked === "loss"
            ? "Hôm nay bạn đã chơi đủ rồi. Mời bạn nghỉ ngơi, hẹn gặp lại ngày mai!"
            : "Hôm nay bạn đã thắng khá nhiều rồi. Mời bạn nghỉ ngơi, hẹn gặp lại ngày mai!"}
        </Alert>
      )}

      {!round && <Card><p className="text-lg">Phòng đã mở, đang chờ người dẫn mở ván đầu tiên.</p></Card>}

      {round && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">Ván {round.no}</h2>
            <span className="text-lg font-semibold text-wine">
              {betting ? (closed ? "Hết giờ đặt cược" : <>Còn <Countdown to={round.closes_at} doneText="Hết giờ" /></>) : round.status === "rolled" ? "Đã lắc" : "Đã hủy"}
            </span>
          </div>

          {round.status === "rolled" && round.dice && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3" role="img" aria-label={`Kết quả: ${round.dice.map((d) => SYMBOLS[d - 1].label).join(", ")}`}>
                {round.dice.map((d, i) => (
                  <div key={i} className="flex h-24 w-24 flex-col items-center justify-center rounded-2xl bg-wine text-white motion-safe:animate-bounce [animation-iteration-count:2]">
                    <span className="text-4xl" aria-hidden>{SYMBOLS[d - 1].emoji}</span>
                    <span className="text-lg font-bold">{SYMBOLS[d - 1].label}</span>
                  </div>
                ))}
              </div>
              {st.bets.length > 0 && (
                <p className="text-lg font-semibold">
                  Bạn đặt {myTotal} {coinLower}, nhận lại {st.bets.reduce((a, b) => a + (b.payout ?? payout(b.amount, b.symbol, round.dice!)), 0)} {coinLower}.
                </p>
              )}
              {results.length > 0 && (
                <ul className="text-base">
                  {results.map((r) => <li key={r.user_id}>{names.get(r.user_id) ?? "Thành viên"}: {r.pay - r.bet >= 0 ? "+" : ""}{r.pay - r.bet} {coinLower}</li>)}
                </ul>
              )}
            </div>
          )}

          {betting && !closed && !st.locked && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SYMBOLS.map((s) => {
                const mine = st.bets.find((b) => b.symbol === s.id)?.amount ?? 0;
                return (
                  <form key={s.id} action={placeBet} className="space-y-2 rounded-2xl border-2 border-champagne bg-ivory p-3">
                    <input type="hidden" name="roundId" value={round.id} />
                    <input type="hidden" name="symbol" value={s.id} />
                    <p className="text-center text-3xl" aria-hidden>{s.emoji}</p>
                    <p className="text-center text-xl font-bold">{s.label}</p>
                    <p className="text-center text-sm text-ink-soft">{mine > 0 ? `Bạn đã cược ${mine}` : "Chưa cược"}</p>
                    <SelectField label="Thêm" name="amount" defaultValue={String(limits.min_bet)}>
                      {amounts.filter((a) => a <= Math.max(limits.min_bet, Math.min(limits.max_bet - mine, limits.round_total - myTotal, budget))).map((a) => (
                        <option key={a} value={a}>{a} {coinLower}</option>
                      ))}
                    </SelectField>
                    <SubmitButton>Đặt</SubmitButton>
                  </form>
                );
              })}
            </div>
          )}

          {betting && st.bets.length > 0 && (
            <p className="text-base">Cược của bạn ở ván này: {st.bets.map((b) => `${SYMBOLS[b.symbol - 1].label} ${b.amount}`).join(", ")} (tổng {myTotal}).</p>
          )}

          {betting && (closed || isAdmin) && (
            <form action={rollRound}>
              <input type="hidden" name="id" value={round.id} />
              <SubmitButton pendingText="Đang lắc…">{closed ? "Hết giờ — Lắc xúc xắc" : "Người dẫn: lắc xúc xắc ngay"}</SubmitButton>
            </form>
          )}
        </Card>
      )}

      {isAdmin && (!round || round.status !== "betting") && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Dành cho người dẫn</h2>
          <form action={newRound} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="roomId" value={room.id} />
            <div className="min-w-48">
              <SelectField label="Thời gian đặt cược" name="seconds" defaultValue="60">
                <option value="30">30 giây</option><option value="60">1 phút</option><option value="120">2 phút</option><option value="300">5 phút</option>
              </SelectField>
            </div>
            <SubmitButton>Mở ván mới</SubmitButton>
          </form>
        </Card>
      )}
      <Link href={`/tro-choi/tv/${room.id}`} className={buttonGhostClass}>Chiếu lên TV</Link>
    </>
  );
}
