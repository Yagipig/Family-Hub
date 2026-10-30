import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { gamesAccess } from "@/lib/games/server";
import { noticeFor } from "@/lib/games/notice";
import { resolveCoin } from "@/lib/coins";
import { SYMBOLS } from "@/lib/games/baucua";
import { GamesAutoRefresh } from "@/components/GamesAutoRefresh";
import { Countdown } from "@/components/Countdown";
import { TvController, type TvAction } from "@/components/TvController";
import { TvBallButton } from "@/components/TvBallButton";
import { LotoAnnouncer } from "@/components/LotoAnnouncer";
import { LotoMusic } from "@/components/LotoMusic";
import { WinCelebration } from "@/components/WinCelebration";
import { lotoBallStyle } from "@/components/LotoBall";

export const metadata = { title: "Trình chiếu TV" };

type Top = Array<{ name: string; balance: number; rank: number }> | null;
type LotoTv = { kind: "loto"; title: string; code: string; status: string; prize_points: number; pot?: number; called_count: number; called: number[]; last: number | null; players: number; winner: { name: string } | null; winners?: Array<{ name: string; province: string | null; share: number }>; top: Top };
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

const wrap = "fixed inset-0 z-50 overflow-y-auto bg-[linear-gradient(160deg,#3b0764_0%,#7b1e2b_58%,#4a044e_100%)] text-white";

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
  const coin = resolveCoin(access.settings);
  const coinLower = coin.name.toLocaleLowerCase("vi-VN");

  if (roomId === "bang-diem") {
    const { data } = await supabase.rpc("games_leaderboard", { p_family: session.familyId });
    const rows = (data ?? []) as Array<{ user_id: string; display_name: string; balance: number; rnk: number }>;
    return (
      <Frame notice live noticeText={noticeFor(coin.name)}>
        <h1 className="text-center text-6xl font-bold text-champagne">Bảng {coinLower} gia đình</h1>
        {rows.length === 0 ? <p className="mt-12 text-center text-4xl">Bảng {coinLower} đang tắt hoặc chưa có ai.</p> : (
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

  const fit = tv.kind === "loto";
  return (
    <Frame notice live noticeText={noticeFor(coin.name)} fit={fit}>
      {tv.kind === "loto" && (
        <LotoView
          tv={tv} coinLower={coinLower}
          chatter={access.settings.loto_chatter ?? 60}
          extraLines={access.settings.loto_extra_lines ?? []}
          musicUrl={access.settings.loto_music_url ?? null}
          roomId={roomId}
          canCall={isAdmin}
        />
      )}
      {tv.kind === "lottery" && <LotteryView tv={tv} tz={session.timezone} coinLower={coinLower} />}
      {tv.kind === "baucua" && <BaucuaView tv={tv} />}
      {tv.top && tv.top.length > 0 && <TopBar top={tv.top} coinLower={coinLower} compact={fit} />}
      {isAdmin && (primary || secondary) && (
        <div className={fit ? "mt-3 shrink-0 border-t border-champagne/40 pt-3" : "mt-10 border-t border-champagne/40 pt-6"}>
          <TvController roomId={roomId} primary={primary} secondary={secondary} compact={fit} />
        </div>
      )}
    </Frame>
  );
}

function Frame({ children, notice, live, noticeText, fit = false }: { children: React.ReactNode; notice?: boolean; live?: boolean; noticeText?: string; fit?: boolean }) {
  // fit: khung chieu cao dung bang man hinh (100dvh), khong cuon — dung cho TV lo to de thay tron
  // ca bang 90 so tren dien thoai (nguoi dung yeu cau 30/10/2026). Cac man TV khac giu cuon nhu cu.
  if (fit) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[linear-gradient(160deg,#3b0764_0%,#7b1e2b_58%,#4a044e_100%)] p-3 text-white sm:p-6">
        <GamesAutoRefresh seconds={3} active={!!live} />
        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-3 text-sm sm:mb-3 sm:text-lg">
            <Link href="/tro-choi" className="rounded-lg border border-champagne/60 px-3 py-1.5 font-semibold text-champagne hover:bg-wine-dark">Thoát</Link>
            {notice && <span className="truncate font-semibold text-champagne-soft">{noticeText}</span>}
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    );
  }
  return (
    <div className={`${wrap} p-6 sm:p-10`}>
      <GamesAutoRefresh seconds={3} active={!!live} />
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4 text-xl">
          <Link href="/tro-choi" className="rounded-lg border border-champagne/60 px-4 py-2 font-semibold text-champagne hover:bg-wine-dark">Thoát</Link>
          {notice && <span className="font-semibold text-champagne-soft">{noticeText}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

function TopBar({ top, coinLower, compact = false }: { top: NonNullable<Top>; coinLower: string; compact?: boolean }) {
  if (compact) {
    return (
      <div className="mt-3 shrink-0 border-t border-champagne/40 pt-2.5">
        <ol className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm sm:text-xl">
          <li className="font-bold text-champagne">Bảng {coinLower}</li>
          {top.slice(0, 6).map((r) => <li key={`${r.rank}-${r.name}`}>{r.rank}. {r.name} <strong className="text-champagne">{r.balance}</strong></li>)}
        </ol>
      </div>
    );
  }
  return (
    <div className="mt-10 border-t border-champagne/40 pt-6">
      <p className="mb-3 text-3xl font-bold text-champagne">Bảng {coinLower}</p>
      <ol className="flex flex-wrap gap-x-10 gap-y-2 text-3xl">
        {top.slice(0, 6).map((r) => <li key={`${r.rank}-${r.name}`}>{r.rank}. {r.name} <strong className="text-champagne">{r.balance}</strong></li>)}
      </ol>
    </div>
  );
}

function LotoView({ tv, coinLower, chatter, extraLines, musicUrl, roomId, canCall }: {
  tv: LotoTv; coinLower: string; chatter: number; extraLines: string[]; musicUrl: string | null; roomId: string; canCall: boolean;
}) {
  const called = new Set(tv.called);
  const winners = tv.winners ?? [];
  const winnerNames = winners.length > 0 ? winners.map((w) => w.name) : tv.winner ? [tv.winner.name] : [];
  // Bong tinh theo chieu cao man hinh de ca trang vua mot man hinh (ke ca tren dien thoai)
  const ballSize = { width: "min(30dvh, 56vw, 24rem)", fontSize: "min(15dvh, 28vw, 11rem)" } as const;
  const ballAction = tv.status === "playing" ? "loto_next" : tv.status === "waiting" ? "loto_start" : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-3">
      {tv.status === "finished" && winnerNames.length > 0 && <WinCelebration fireKey={`${roomId}:tv-win`} big />}
      <div className="shrink-0 text-center">
        <h1 className="truncate text-2xl font-bold text-champagne sm:text-4xl">{tv.title}</h1>
        <p className="mt-0.5 truncate text-[13px] text-white/90 sm:text-2xl">
          Mã phòng <strong className="tracking-[0.2em] text-champagne">{tv.code}</strong> · {tv.players} người · Giải {tv.prize_points} {coinLower}{(tv.pot ?? 0) > 0 ? ` + cược ${(tv.pot ?? 0).toLocaleString("vi-VN")}` : ""}
        </p>
      </div>
      {winnerNames.length > 0 ? (
        <div className="shrink-0 space-y-2" role="status" aria-live="polite">
          <p className="text-center text-4xl font-bold text-champagne sm:text-6xl">🎉 KINH RỒI NHÉ!</p>
          <ul className="mx-auto max-w-4xl space-y-2">
            {winners.length > 0 ? winners.map((w, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-3 rounded-2xl bg-wine-dark px-5 py-2.5 text-xl sm:text-3xl">
                <span>{w.name}{w.province ? ` · bảng ${w.province}` : ""}</span>
                <strong className="text-champagne">+{w.share} {coinLower}</strong>
              </li>
            )) : (
              <li className="text-center text-4xl font-bold sm:text-5xl">{winnerNames[0]}</li>
            )}
          </ul>
        </div>
      ) : (
        <div className="flex shrink-0 flex-col items-center gap-1.5" role="status" aria-live="polite">
          <p className="text-base sm:text-2xl">{tv.status === "waiting" ? "Chờ bắt đầu" : tv.status === "playing" ? "Số vừa hô" : tv.status === "paused" ? "Đang tạm dừng" : "Ván đã kết thúc"}</p>
          {canCall && ballAction ? (
            <TvBallButton key={tv.last ?? "none"} roomId={roomId} action={ballAction} last={tv.last} />
          ) : tv.last != null ? (
            <div
              key={tv.last}
              style={{ ...lotoBallStyle(tv.last), ...ballSize }}
              className="animate-loto-pop flex aspect-square items-center justify-center rounded-full font-black leading-none text-white ring-4 ring-yellow-300/80 sm:ring-8"
            >
              {tv.last}
            </div>
          ) : (
            <div style={ballSize} className="flex aspect-square items-center justify-center rounded-full bg-champagne font-bold leading-none text-wine-dark">–</div>
          )}
        </div>
      )}
      <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-wrap items-center justify-center gap-2 rounded-xl bg-white/95 px-3 py-2">
        <LotoAnnouncer
          compact
          status={tv.status as "waiting" | "playing" | "paused" | "finished" | "cancelled"}
          last={tv.last}
          called={tv.called}
          myGrids={[]}
          winRows={1}
          winnerNames={winnerNames}
          chatter={chatter}
          extraLines={extraLines}
        />
        <LotoMusic url={musicUrl} />
      </div>
      <ol
        className="grid min-h-0 flex-1 grid-cols-10 gap-1 sm:gap-1.5"
        style={{ gridTemplateRows: "repeat(9, minmax(0, 1fr))" }}
        aria-label="Bảng 90 số"
      >
        {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => (
          <li key={n} style={called.has(n) ? lotoBallStyle(n) : undefined} className={`flex items-center justify-center rounded-full text-[clamp(0.75rem,2.4dvh,1.75rem)] font-black ${
            n === tv.last ? "text-white ring-4 ring-yellow-300" : called.has(n) ? "text-white" : "bg-black/25 text-white/35"}`}>{n}</li>
        ))}
      </ol>
    </div>
  );
}

function LotteryView({ tv, tz, coinLower }: { tv: LotteryTv; tz: string; coinLower: string }) {
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
          {tv.prizes.map((p) => <li key={p.rank}>Giải {p.rank}: {p.label}{p.kind === "points" ? ` (${p.points} ${coinLower})` : ""}</li>)}
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
