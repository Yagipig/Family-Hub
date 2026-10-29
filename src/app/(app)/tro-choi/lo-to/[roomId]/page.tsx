import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { gamesAccess, profileNames } from "@/lib/games/server";
import { resolveCoin } from "@/lib/coins";
import { verifyLoto } from "@/lib/games/fair";
import { PROVINCE63_BY_CODE } from "@/lib/games/provinces63";
import { Alert, Card, SelectField, buttonGhostClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { GamesBanner } from "@/components/GamesBanner";
import { GamesAutoRefresh } from "@/components/GamesAutoRefresh";
import { LotoBoard } from "@/components/LotoBoard";
import { LotoCards } from "@/components/LotoCards";
import { LotoHostPanel } from "@/components/LotoHostPanel";
import { LotoRealtime } from "@/components/LotoRealtime";
import { ProvincePicker } from "@/components/ProvincePicker";
import {
  callNext, claimBoard, claimKinh, endRoom, joinRoom, pauseRoom, releaseBoard, resumeRoom, startRoom, transferHostRandom, undoCallRoom,
} from "../actions";

export const metadata = { title: "Phòng lô tô" };

type Room = {
  id: string; title: string; code: string; status: "waiting" | "playing" | "paused" | "finished" | "cancelled";
  prize_points: number; commit_hash: string; called_count: number; winner_user: string | null; winner_card: string | null;
  mode: "classic" | "province"; host_user: string | null; created_by: string | null;
  win_rows: number; auto_win: boolean; allow_board_change: boolean;
};

const STATUS: Record<string, string> = {
  waiting: "Đang chờ người chơi chọn bảng", playing: "Đang hô số", paused: "Đang tạm dừng",
  finished: "Đã kết thúc", cancelled: "Đã hủy",
};

export default async function LotoRoomPage({ params, searchParams }: {
  params: Promise<{ roomId: string }>; searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const session = await requireSession();
  const { roomId } = await params;
  const { ok, error } = await searchParams;
  const access = await gamesAccess(session);
  if (access.state !== "ok") {
    return (
      <>
        <h1 className="text-3xl font-bold text-wine">Lô tô</h1>
        <GamesBanner coinName={resolveCoin(access.settings).name} />
        <Card className="space-y-3">
          <p className="text-lg">{access.state === "off" ? "Trò chơi đang tạm tắt." : "Tài khoản khách không tham gia trò chơi."}</p>
          <Link href="/tro-choi" className={buttonGhostClass}>Về trang trò chơi</Link>
        </Card>
      </>
    );
  }
  if (!/^[0-9a-f-]{36}$/.test(roomId)) notFound();

  const supabase = await createClient();
  const { data: rd } = await supabase.from("loto_rooms")
    .select("id, title, code, status, prize_points, commit_hash, called_count, winner_user, winner_card, mode, host_user, created_by, win_rows, auto_win, allow_board_change")
    .eq("id", roomId).maybeSingle();
  if (!rd) notFound();
  const room = rd as Room;
  const province = room.mode === "province";

  const [{ data: cd }, { data: calls }, { data: sd }, { data: bd }, { data: vd }, { data: wd }] = await Promise.all([
    supabase.from("loto_cards").select("id, card_no, grid, user_id, board_code").eq("room_id", roomId).order("card_no"),
    supabase.from("loto_calls").select("seq, number").eq("room_id", roomId).order("seq"),
    supabase.from("game_seeds").select("seed").eq("kind", "loto").eq("ref_id", roomId).maybeSingle(),
    province ? supabase.from("loto_boards").select("code, province_name, grid") : Promise.resolve({ data: null }),
    province ? supabase.from("loto_room_cards_v").select("board_code, user_id").eq("room_id", roomId) : Promise.resolve({ data: null }),
    supabase.from("loto_winners").select("user_id, card_id, board_code, share_points").eq("room_id", roomId),
  ]);
  const allCards = (cd ?? []) as Array<{ id: string; card_no: number; grid: number[]; user_id: string; board_code: string | null }>;
  const mine = allCards.filter((c) => c.user_id === session.userId);
  const winnerCard = room.winner_card ? allCards.find((c) => c.id === room.winner_card) : undefined;
  const called = ((calls ?? []) as Array<{ seq: number; number: number }>).map((c) => c.number);
  const last = called.length ? called[called.length - 1] : null;
  const seed = (sd as { seed: string } | null)?.seed ?? null;
  const verify = seed ? verifyLoto({ commit: room.commit_hash, seed, called }) : null;

  const boards = (bd ?? []) as Array<{ code: string; province_name: string; grid: number[] }>;
  const grids: Record<string, number[]> = {};
  const boardName: Record<string, string> = {};
  for (const b of boards) { grids[b.code] = b.grid; boardName[b.code] = b.province_name; }
  const claims = (vd ?? []) as Array<{ board_code: string | null; user_id: string }>;
  const winners = (wd ?? []) as Array<{ user_id: string; card_id: string; board_code: string | null; share_points: number }>;

  const hostId = room.host_user ?? room.created_by;
  const nameIds = [...new Set([
    ...(hostId ? [hostId] : []),
    ...claims.map((c) => c.user_id),
    ...winners.map((w) => w.user_id),
    ...(room.winner_user ? [room.winner_user] : []),
  ])];
  const names = await profileNames(nameIds);
  const nameOf = (id: string | null | undefined) => (id ? names.get(id) ?? "Thành viên" : "Thành viên");
  const isHost = (hostId === session.userId) || access.isAdmin;
  const taken: Record<string, { name: string; mine: boolean }> = {};
  for (const c of claims) {
    if (c.board_code) taken[c.board_code] = { name: nameOf(c.user_id), mine: c.user_id === session.userId };
  }
  const myBoard = mine.find((c) => c.board_code);
  const live = room.status === "waiting" || room.status === "playing" || room.status === "paused";
  const coin = resolveCoin(access.settings);

  return (
    <>
      <GamesAutoRefresh seconds={6} active={live} />
      <LotoRealtime roomId={room.id} />
      <h1 className="text-3xl font-bold text-wine">{room.title}</h1>
      <GamesBanner coinName={coin.name} />
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <Card className="space-y-2">
        <p className="text-lg">
          Mã phòng <strong className="tracking-widest">{room.code}</strong> · <strong>{STATUS[room.status]}</strong>
          {province && <> · Lô tô truyền thống 63 tỉnh · Thắng: đủ <strong>{room.win_rows} hàng ngang</strong>{room.auto_win ? " · Tự động báo người thắng" : ""}</>}
          <br />
          Giải kinh {room.prize_points} {coin.name.toLocaleLowerCase("vi-VN")}
          {winners.length > 1 && room.status === "finished" ? " (chia đều cho những người cùng thắng)" : ""} · Chủ phòng: <strong>{nameOf(hostId)}</strong>
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={`/tro-choi/tv/${room.id}`} className={buttonGhostClass}>Chiếu lên TV</Link>
          <Link href="/tro-choi/lo-to" className={buttonGhostClass}>Danh sách phòng</Link>
        </div>
      </Card>

      {room.status === "finished" && (
        <Card className="space-y-2">
          {winners.length > 0 ? (
            <>
              <p className="text-2xl font-bold text-wine">🎉 KINH RỒI NHÉ! {winners.length > 1 ? `${winners.length} người cùng thắng:` : "Người thắng:"}</p>
              <ul className="space-y-1 text-lg">
                {winners.map((w) => (
                  <li key={w.card_id}>
                    <strong>{nameOf(w.user_id)}</strong>
                    {w.board_code && <> — bảng {boardName[w.board_code] ?? PROVINCE63_BY_CODE.get(w.board_code)?.name ?? w.board_code} ({w.board_code})</>}
                    {" "}· nhận {w.share_points} {coin.name.toLocaleLowerCase("vi-VN")}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-2xl font-bold text-wine">
              {room.winner_user ? `KINH! Người thắng: ${nameOf(room.winner_user)}` : "Ván kết thúc, không có người kinh."}
            </p>
          )}
        </Card>
      )}

      {isHost && room.status === "waiting" && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Chủ phòng</h2>
          <div className="flex flex-wrap gap-3">
            <form action={startRoom}><input type="hidden" name="id" value={room.id} /><SubmitButton>Bắt đầu ván</SubmitButton></form>
            <form action={transferHostRandom}><input type="hidden" name="id" value={room.id} />
              <button className="inline-flex min-h-12 items-center rounded-xl border border-ink-soft/40 px-4 py-2 text-base font-semibold text-ink-soft">Chuyển chủ phòng (ngẫu nhiên)</button>
            </form>
            <form action={endRoom}><input type="hidden" name="id" value={room.id} />
              <button className="inline-flex min-h-12 items-center rounded-xl border border-danger/50 px-4 py-2 text-base font-semibold text-danger">Hủy phòng</button>
            </form>
          </div>
          {province && claims.length === 0 && <p className="text-base text-ink-soft">Chưa có ai chọn bảng — chờ mọi người chọn bảng tỉnh rồi bắt đầu.</p>}
        </Card>
      )}

      {isHost && (room.status === "playing" || room.status === "paused") && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Bàn điều khiển chủ phòng {room.status === "paused" && "· ĐANG TẠM DỪNG"}</h2>
          <LotoHostPanel
            roomId={room.id}
            status={room.status}
            autoWin={room.auto_win}
            calledCount={called.length}
            endAction={endRoom}
            resumeAction={resumeRoom}
            transferAction={transferHostRandom}
          />
        </Card>
      )}

      {!isHost && access.isAdmin && live && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Quản trị trò chơi</h2>
          <div className="flex flex-wrap gap-3">
            {room.status === "playing" && (
              <form action={callNext}><input type="hidden" name="id" value={room.id} /><SubmitButton pendingText="Đang hô…">Hô số tiếp theo</SubmitButton></form>
            )}
            {room.status === "playing" && (
              <form action={pauseRoom}><input type="hidden" name="id" value={room.id} /><SubmitButton>Tạm dừng</SubmitButton></form>
            )}
            {room.status === "paused" && (
              <form action={resumeRoom}><input type="hidden" name="id" value={room.id} /><SubmitButton>Tiếp tục</SubmitButton></form>
            )}
            {room.status !== "waiting" && (
              <form action={undoCallRoom}><input type="hidden" name="id" value={room.id} /><SubmitButton>Hoàn tác số vừa hô</SubmitButton></form>
            )}
          </div>
        </Card>
      )}

      {room.status === "paused" && !isHost && (
        <Card><p className="text-lg font-semibold">⏸ Chủ phòng đang tạm dừng ván. Mọi người chờ một chút nhé!</p></Card>
      )}

      {province && room.status === "waiting" && !myBoard && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Chọn bảng tỉnh của bạn</h2>
          <p className="text-base text-ink-soft">Mỗi tỉnh là một bảng lô tô cố định. Bấm vào tỉnh trên bản đồ (hoặc thẻ tỉnh bên dưới) để xem bảng rồi bấm &ldquo;Chọn bảng này&rdquo;. Bảng đã chọn sẽ khóa cho bạn.</p>
          <ProvincePicker roomId={room.id} grids={grids} taken={taken} claimAction={claimBoard} />
        </Card>
      )}

      {province && claims.length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-xl font-bold">Người chơi đã chọn bảng ({claims.length})</h2>
          <ul className="grid gap-1 text-lg sm:grid-cols-2">
            {claims.filter((c) => c.board_code).map((c) => (
              <li key={c.board_code ?? c.user_id}>
                <strong>{boardName[c.board_code!] ?? c.board_code}</strong> — {nameOf(c.user_id)}{c.user_id === session.userId ? " (bạn)" : ""}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!province && room.status === "waiting" && mine.length === 0 && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Nhận tờ lô tô</h2>
          <form action={joinRoom} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="roomId" value={room.id} />
            <div className="min-w-48">
              <SelectField label="Số tờ muốn chơi" name="cards" defaultValue="1">
                <option value="1">1 tờ</option><option value="2">2 tờ</option><option value="3">3 tờ</option>
              </SelectField>
            </div>
            <SubmitButton>Tham gia</SubmitButton>
          </form>
        </Card>
      )}

      {(room.status === "playing" || room.status === "paused") && mine.length === 0 && (
        <Card className="space-y-2">
          <p className="text-lg font-semibold">Ván chơi đã bắt đầu. Bạn có thể theo dõi và tham gia ở ván tiếp theo.</p>
          <p className="text-base text-ink-soft">Người vào sau khi ván bắt đầu chỉ xem được, không chọn bảng trong ván hiện tại.</p>
        </Card>
      )}

      {(room.status === "playing" || room.status === "paused" || room.status === "finished" || called.length > 0) && (
        <Card><LotoBoard called={called} last={last} /></Card>
      )}

      {mine.length > 0 && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">{province ? "Bảng của bạn" : "Tờ lô tô của bạn"}</h2>
          <LotoCards
            roomId={room.id}
            cards={mine.map((c) => ({
              id: c.id, cardNo: c.card_no, grid: c.grid,
              boardLabel: c.board_code ? `Bảng ${boardName[c.board_code] ?? c.board_code} · ${c.board_code}` : undefined,
            }))}
            called={called}
            playing={room.status === "playing"}
            winnerCardId={room.winner_card}
            claimAction={claimKinh}
            winRows={room.win_rows}
          />
          {province && room.status === "waiting" && room.allow_board_change && myBoard && (
            <form action={releaseBoard} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="roomId" value={room.id} />
              <button className="inline-flex min-h-12 items-center rounded-xl border border-wine px-4 py-2 text-base font-semibold text-wine">Nhả bảng để chọn bảng khác</button>
              <span className="text-sm text-ink-soft">Chủ phòng cho phép đổi bảng trước khi bắt đầu ván.</span>
            </form>
          )}
        </Card>
      )}
      {winnerCard && !mine.some((c) => c.id === winnerCard.id) && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Tờ chiến thắng</h2>
          <LotoCards roomId={room.id} cards={[{ id: winnerCard.id, cardNo: winnerCard.card_no, grid: winnerCard.grid }]}
            called={called} playing={false} winnerCardId={winnerCard.id} claimAction={claimKinh} winRows={room.win_rows} />
        </Card>
      )}

      <Card>
        <details className="text-sm">
          <summary className="min-h-12 cursor-pointer py-2 text-base font-semibold">Kiểm chứng công bằng (cam kết – tiết lộ)</summary>
          <div className="space-y-2 pb-2 text-ink-soft">
            <p>Khi tạo phòng, hệ thống công bố mã cam kết = SHA-256 của seed bí mật. Thứ tự hô số là hoán vị của 1–90 tính từ seed. Khi ván kết thúc, seed được tiết lộ để mọi người tự kiểm tra.</p>
            <p className="break-all"><strong>Mã cam kết:</strong> <code>{room.commit_hash}</code></p>
            {seed ? <p className="break-all"><strong>Seed:</strong> <code>{seed}</code></p> : <p>Seed sẽ được công bố khi ván kết thúc.</p>}
            {verify && (
              <p className={verify.ok ? "font-semibold text-ok" : "font-semibold text-danger"}>
                {verify.ok ? "Đã tự kiểm chứng: seed khớp mã cam kết và thứ tự số đã hô khớp thuật toán công khai." : verify.problems.join(" ")}
              </p>
            )}
          </div>
        </details>
      </Card>
    </>
  );
}
