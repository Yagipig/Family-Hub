import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { gamesAccess, profileNames } from "@/lib/games/server";
import { resolveCoin } from "@/lib/coins";
import { verifyLoto } from "@/lib/games/fair";
import { Alert, Card, SelectField, buttonGhostClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { GamesBanner } from "@/components/GamesBanner";
import { GamesAutoRefresh } from "@/components/GamesAutoRefresh";
import { LotoBoard } from "@/components/LotoBoard";
import { LotoCards } from "@/components/LotoCards";
import { callNext, claimKinh, endRoom, joinRoom, startRoom } from "../actions";

export const metadata = { title: "Phòng lô tô" };

type Room = {
  id: string; title: string; code: string; status: "waiting" | "playing" | "finished" | "cancelled";
  prize_points: number; commit_hash: string; called_count: number; winner_user: string | null; winner_card: string | null;
};

const STATUS: Record<string, string> = { waiting: "Đang chờ người chơi", playing: "Đang hô số", finished: "Đã kết thúc", cancelled: "Đã hủy" };

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
    .select("id, title, code, status, prize_points, commit_hash, called_count, winner_user, winner_card").eq("id", roomId).maybeSingle();
  if (!rd) notFound();
  const room = rd as Room;
  const [{ data: cd }, { data: calls }, { data: sd }] = await Promise.all([
    supabase.from("loto_cards").select("id, card_no, grid, user_id").eq("room_id", roomId).order("card_no"),
    supabase.from("loto_calls").select("seq, number").eq("room_id", roomId).order("seq"),
    supabase.from("game_seeds").select("seed").eq("kind", "loto").eq("ref_id", roomId).maybeSingle(),
  ]);
  const allCards = (cd ?? []) as Array<{ id: string; card_no: number; grid: number[]; user_id: string }>;
  const mine = allCards.filter((c) => c.user_id === session.userId);
  const winnerCard = room.winner_card ? allCards.find((c) => c.id === room.winner_card) : undefined;
  const called = ((calls ?? []) as Array<{ seq: number; number: number }>).map((c) => c.number);
  const last = called.length ? called[called.length - 1] : null;
  const seed = (sd as { seed: string } | null)?.seed ?? null;
  const verify = seed ? verifyLoto({ commit: room.commit_hash, seed, called }) : null;
  const names = await profileNames(room.winner_user ? [room.winner_user] : []);
  const live = room.status === "waiting" || room.status === "playing";

  return (
    <>
      <GamesAutoRefresh seconds={4} active={live} />
      <h1 className="text-3xl font-bold text-wine">{room.title}</h1>
      <GamesBanner coinName={resolveCoin(access.settings).name} />
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <Card className="space-y-2">
        <p className="text-lg">
          Mã phòng <strong className="tracking-widest">{room.code}</strong> · <strong>{STATUS[room.status]}</strong> · Giải kinh {room.prize_points} {resolveCoin(access.settings).name.toLocaleLowerCase("vi-VN")}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={`/tro-choi/tv/${room.id}`} className={buttonGhostClass}>Chiếu lên TV</Link>
          <Link href="/tro-choi/lo-to" className={buttonGhostClass}>Danh sách phòng</Link>
        </div>
      </Card>

      {room.status === "finished" && (
        <Card className="space-y-2">
          <p className="text-2xl font-bold text-wine">
            {room.winner_user ? `KINH! Người thắng: ${names.get(room.winner_user) ?? "Thành viên"}` : "Ván kết thúc, không có người kinh."}
          </p>
        </Card>
      )}

      {access.isAdmin && live && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Dành cho người hô số</h2>
          <div className="flex flex-wrap gap-3">
            {room.status === "waiting" && (
              <form action={startRoom}><input type="hidden" name="id" value={room.id} /><SubmitButton>Bắt đầu ván</SubmitButton></form>
            )}
            {room.status === "playing" && (
              <form action={callNext}><input type="hidden" name="id" value={room.id} /><SubmitButton pendingText="Đang hô…">Hô số tiếp theo</SubmitButton></form>
            )}
            <form action={endRoom}><input type="hidden" name="id" value={room.id} /><SubmitButton>{room.status === "waiting" ? "Hủy phòng" : "Kết thúc ván"}</SubmitButton></form>
          </div>
        </Card>
      )}

      {room.status === "waiting" && mine.length === 0 && (
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

      {(room.status === "playing" || room.status === "finished" || called.length > 0) && <Card><LotoBoard called={called} last={last} /></Card>}

      {mine.length > 0 && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Tờ lô tô của bạn</h2>
          <LotoCards
            roomId={room.id}
            cards={mine.map((c) => ({ id: c.id, cardNo: c.card_no, grid: c.grid }))}
            called={called}
            playing={room.status === "playing"}
            winnerCardId={room.winner_card}
            claimAction={claimKinh}
          />
        </Card>
      )}
      {winnerCard && !mine.some((c) => c.id === winnerCard.id) && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Tờ chiến thắng</h2>
          <LotoCards roomId={room.id} cards={[{ id: winnerCard.id, cardNo: winnerCard.card_no, grid: winnerCard.grid }]}
            called={called} playing={false} winnerCardId={winnerCard.id} claimAction={claimKinh} />
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
