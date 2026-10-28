import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { gamesAccess, NOTICE } from "@/lib/games/server";
import { SYMBOLS } from "@/lib/games/baucua";
import { GamesAutoRefresh } from "@/components/GamesAutoRefresh";
import { Countdown } from "@/components/Countdown";
import { TvController, type TvAction } from "@/components/TvController";

export const metadata = { title: "Trình chiếu TV" };

type Top = Array<{ name: string; balance: number; rank: number }> | null;
type LotoTv = { kind: "loto"; title: string; code: string; status: string; prize_points: number; called_count: number; called: number[]; last: number | null; players: number; winner: { name: string } | null; top: Top };
type LotteryTv = {
  kind: "lottery"; title: string; status: string; draw_at: string; ticket_count: number; commit: string; seed: string | null;
  prizes: Array<{ rank: number; label: string; points: number | null; kind: string }>;
  results: Array<{ rank: number; label: string; ticket_no: number; name: string; points: number }>; top: Top;
};
type BaucuaTv = {
  kind: "baucua"; id: string; title: string; status: string;
  round: { id: string; no: number; status: string; closes_at: string; dice: number[] | null } | null;
  totals: Array<{ symbol: number; amount: number }>; players: number;
  last: { no: number; dice: number[]; results: Array<{ name: string; net: number }> } | null; top: Top;
};
type Tv = LotoTv | LotteryTv | BaucuaTv;

const wrap = "fixed inset-0 z-50 overflow-y-auto bg-wine text-white";

export default async function TvPage({ params }: { params: Promise<{ roomId: string }> }) {
  const session = await requireSession();
  const { roomId } = await params;
  const access = await gamesAccess(session);
  if (access.state !== "ok") {
    return (
      <div className={`${wrap} flex items-center justify-center p-8 text-center`}>
        <div className="space-y-6">
          <p className="text-4xl font-bold">{access.state === "off" ? "Trò chơi đang tạm tắt" : "Tài khoản khách không xem được trò chơi"}</p>
          <Link href="/tro-choi" className="inline-block rounded-xl border-2 border-champagne px-6 py-3 text-2xl font-semibold text-champagne">Quay lại</Link>
        </div>
      </div>
    );
  }
  const supabase = await createClient();

  if (roomId === "bang-diem") {
    const { data } = await supabase.rpc("games_leaderboard", { p_family: session.familyId });
    const rows = (data ?? []) as Array<{ user_id: string; display_name: string; balance: number; rnk: number }>;
    return (
      <Frame notice live>
        <h1 className="text-center text-6xl font-bold text-champagne">Bảng điểm gia đình</h1>
        {rows.length === 0 ? <p className="mt-12 text-center text-4xl">Bảng điểm đang tắt hoặc chưa có ai.</p> : (
          <ol className="mx-auto mt-10 max-w-4xl space-y-4 text-5xl">
            {rows.slice(0, 10).map((r) => (
              <li key={r.user_id} className="flex justify-between gap-6 rounded-2xl bg-wine-dark px-8 py-4">
                <span>{r.rnk}. {r.display_name}</span><strong className="text-champagne">{r.balance}</strong>
              </li>
            ))}
          </ol>
        )}
      </Frame>
    );
  }

  if (!/^[0-9a-f-]{36}$/.test(roomId)) notFound();
  let { data, error } = await supabase.rpc("games_tv_state", { p_id: roomId });
  if (error || !data) notFound();
  // Toi gio quay so / het gio dat cuoc thi tu chot (CSDL tu kiem tra gio; loi thi bo qua)
  const cur = data as Tv;
  const lotteryDue = cur.kind === "lottery" && cur.status === "open" && new Date(cur.draw_at).getTime() <= Date.now();
  const bcDue = cur.kind === "baucua" && cur.round?.status === "betting" && new Date(cur.round.closes_at).getTime() <= Date.now();
  if (lotteryDue) await supabase.rpc("lottery_run", { p_draw: roomId });
  else if (bcDue && cur.kind === "baucua" && cur.round) await supabase.rpc("bc_roll", { p_round: cur.round.id });
  if (lotteryDue || bcDue) {
    ({ data, error } = await supabase.rpc("games_tv_state", { p_id: roomId }));
    if (error || !data) notFound();
  }
  const tv = data as Tv;
  const isAdmin = access.isAdmin;

  let primary: TvAction | null = null;
  const secondary: TvAction | null = null;
  if (isAdmin) {
    if (tv.kind === "loto") {
      if (tv.status === "waiting") primary = { action: "loto_start", label: "Bắt đầu ván", key: "Space" };
      else if (tv.status === "playing") primary = { action: "loto_next", label: "Hô số tiếp", key: "Space" };
    } else if (tv.kind === "lottery") {
      if (tv.status === "open") primary = { action: "lottery_run", label: "Quay số", key: "Space" };
    } else if (tv.kind === "baucua") {
      if (tv.round?.status === "betting") primary = { action: "bc_roll", label: "Lắc xúc xắc", key: "Space", targetId: tv.round.id };
      else if (tv.status === "open") primary = { action: "bc_new_round", label: "Mở ván mới", key: "Space" };
    }
  }

  return (
    <Frame notice live>
      {tv.kind === "loto" && <LotoView tv={tv} />}
      {tv.kind === "lottery" && <LotteryView tv={tv} tz={session.timezone} />}
      {tv.kind === "baucua" && <BaucuaView tv={tv} />}
      {tv.top && tv.top.length > 0 && <TopBar top={tv.top} />}
      {isAdmin && (primary || secondary) && (
        <div className="mt-10 border-t border-champagne/40 pt-6"><TvController roomId={roomId} primary={primary} secondary={secondary} /></div>
      )}
    </Frame>
  );
}

function Frame({ children, notice, live }: { children: React.ReactNode; notice?: boolean; live?: boolean }) {
  return (
    <div className={`${wrap} p-6 sm:p-10`}>
      <GamesAutoRefresh seconds={3} active={!!live} />
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4 text-xl">
          <Link href="/tro-choi" className="rounded-lg border border-champagne/60 px-4 py-2 font-semibold text-champagne hover:bg-wine-dark">Thoát</Link>
          {notice && <span className="font-semibold text-champagne-soft">{NOTICE}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

function TopBar({ top }: { top: NonNullable<Top> }) {
  return (
    <div className="mt-10 border-t border-champagne/40 pt-6">
      <p className="mb-3 text-3xl font-bold text-champagne">Bảng điểm</p>
      <ol className="flex flex-wrap gap-x-10 gap-y-2 text-3xl">
        {top.slice(0, 6).map((r) => <li key={`${r.rank}-${r.name}`}>{r.rank}. {r.name} <strong className="text-champagne">{r.balance}</strong></li>)}
      </ol>
    </div>
  );
}

function LotoView({ tv }: { tv: LotoTv }) {
  const called = new Set(tv.called);
  return (
    <div className="space-y-8">
      <h1 className="text-center text-5xl font-bold text-champagne">{tv.title}</h1>
      <p className="text-center text-3xl">Mã phòng <strong className="tracking-[0.3em] text-champagne">{tv.code}</strong> · {tv.players} người chơi · Giải kinh {tv.prize_points} điểm</p>
      {tv.winner ? (
        <p className="text-center text-7xl font-bold text-champagne">KINH! {tv.winner.name}</p>
      ) : (
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <p className="text-3xl">{tv.status === "waiting" ? "Chờ bắt đầu" : tv.status === "playing" ? "Số vừa hô" : "Ván đã kết thúc"}</p>
          <div className="flex h-72 w-72 items-center justify-center rounded-full bg-champagne text-[10rem] font-bold leading-none text-wine-dark sm:h-96 sm:w-96 sm:text-[14rem]">
            {tv.last ?? "–"}
          </div>
        </div>
      )}
      <ol className="grid grid-cols-10 gap-2 text-2xl sm:text-4xl" aria-label="Bảng 90 số">
        {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => (
          <li key={n} className={`flex aspect-square items-center justify-center rounded-lg font-bold ${
            n === tv.last ? "bg-champagne text-wine-dark" : called.has(n) ? "bg-white text-wine" : "bg-wine-dark text-champagne/50"}`}>{n}</li>
        ))}
      </ol>
    </div>
  );
}

function LotteryView({ tv, tz }: { tv: LotteryTv; tz: string }) {
  return (
    <div className="space-y-8">
      <h1 className="text-center text-6xl font-bold text-champagne">{tv.title}</h1>
      {tv.status === "open" && (
        <>
          <p className="text-center text-4xl">Quay số lúc {formatDateTime(tv.draw_at, tz)}</p>
          <p className="text-center text-8xl font-bold text-champagne"><Countdown to={tv.draw_at} doneText="Đến giờ quay!" /></p>
          <p className="text-center text-4xl">Đã phát {tv.ticket_count} vé</p>
        </>
      )}
      {tv.status === "cancelled" && <p className="text-center text-5xl">Kỳ quay đã được hủy</p>}
      {tv.status === "drawn" && (
        <ol className="mx-auto max-w-5xl space-y-4 text-5xl">
          {tv.results.map((r) => (
            <li key={r.rank} className="flex flex-wrap justify-between gap-4 rounded-2xl bg-wine-dark px-8 py-5">
              <span>Giải {r.rank}: {r.label}</span>
              <strong className="text-champagne">Vé #{r.ticket_no} · {r.name}{r.points > 0 ? ` · +${r.points}` : ""}</strong>
            </li>
          ))}
          {tv.results.length === 0 && <li className="text-center">Không có vé nào nên chưa trao giải.</li>}
        </ol>
      )}
      {tv.status === "open" && (
        <ul className="mx-auto max-w-4xl space-y-2 text-4xl">
          {tv.prizes.map((p) => <li key={p.rank}>Giải {p.rank}: {p.label}{p.kind === "points" ? ` (${p.points} điểm)` : ""}</li>)}
        </ul>
      )}
      <div className="break-all text-center text-lg text-champagne-soft">
        <p>Mã cam kết công bố trước khi quay: {tv.commit}</p>
        {tv.seed && <p>Seed tiết lộ sau khi quay: {tv.seed}</p>}
      </div>
    </div>
  );
}

function BaucuaView({ tv }: { tv: BaucuaTv }) {
  const dice = tv.round?.status === "rolled" ? tv.round.dice : tv.last?.dice ?? null;
  const total = (s: number) => tv.totals.find((t) => t.symbol === s)?.amount ?? 0;
  return (
    <div className="space-y-8">
      <h1 className="text-center text-5xl font-bold text-champagne">{tv.title}</h1>
      {tv.round ? (
        <p className="text-center text-4xl">
          Ván {tv.round.no} ·{" "}
          {tv.round.status === "betting" ? <>còn <strong className="text-champagne"><Countdown to={tv.round.closes_at} doneText="hết giờ đặt cược" /></strong></> : tv.round.status === "rolled" ? "đã lắc" : "đã hủy"}
          {" "}· {tv.players} người đặt
        </p>
      ) : <p className="text-center text-4xl">Chờ người dẫn mở ván đầu tiên</p>}
      {dice && (
        <div className="flex flex-wrap justify-center gap-6" role="img" aria-label={`Kết quả: ${dice.map((d) => SYMBOLS[d - 1].label).join(", ")}`}>
          {dice.map((d, i) => (
            <div key={i} className="flex h-48 w-48 flex-col items-center justify-center rounded-3xl bg-champagne text-wine-dark motion-safe:animate-bounce [animation-iteration-count:2] sm:h-64 sm:w-64">
              <span className="text-8xl" aria-hidden>{SYMBOLS[d - 1].emoji}</span>
              <span className="text-5xl font-bold">{SYMBOLS[d - 1].label}</span>
            </div>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-3 gap-4 text-center text-3xl sm:grid-cols-6">
        {SYMBOLS.map((s) => (
          <li key={s.id} className="rounded-2xl bg-wine-dark px-3 py-4"><span aria-hidden>{s.emoji}</span> {s.label}<br /><strong className="text-champagne">{total(s.id)}</strong></li>
        ))}
      </ul>
      {tv.last && tv.last.results.length > 0 && (
        <div>
          <p className="mb-2 text-3xl font-bold text-champagne">Kết quả ván {tv.last.no}</p>
          <ul className="flex flex-wrap gap-x-10 gap-y-2 text-3xl">
            {tv.last.results.map((r, i) => <li key={i}>{r.name}: {r.net >= 0 ? "+" : ""}{r.net}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
