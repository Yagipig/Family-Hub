import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { gamesAccess } from "@/lib/games/server";
import { Alert, Card, Field, buttonClass, buttonGhostClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { GamesBanner } from "@/components/GamesBanner";
import { GamesAutoRefresh } from "@/components/GamesAutoRefresh";
import { findRoomByCode } from "./actions";

export const metadata = { title: "Lô tô" };

const STATUS: Record<string, string> = { waiting: "Đang chờ người chơi", playing: "Đang hô số", finished: "Đã kết thúc", cancelled: "Đã hủy" };

export default async function LotoHome({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireSession();
  const { ok, error } = await searchParams;
  const access = await gamesAccess(session);
  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Lô tô</h1>
      <GamesBanner />
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {access.state !== "ok" ? (
        <Card className="space-y-3">
          <p className="text-lg">{access.state === "off" ? "Trò chơi đang tạm tắt." : "Tài khoản khách không tham gia trò chơi."}</p>
          <Link href="/tro-choi" className={buttonGhostClass}>Về trang trò chơi</Link>
        </Card>
      ) : (
        <Rooms tz={session.timezone} isAdmin={access.isAdmin} />
      )}
    </>
  );
}

async function Rooms({ tz, isAdmin }: { tz: string; isAdmin: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.from("loto_rooms").select("id, title, code, status, prize_points, created_at")
    .order("created_at", { ascending: false }).limit(8);
  const rooms = (data ?? []) as Array<{ id: string; title: string; code: string; status: string; prize_points: number; created_at: string }>;
  return (
    <>
      <GamesAutoRefresh seconds={8} active={rooms.some((r) => r.status === "waiting" || r.status === "playing")} />
      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Vào phòng bằng mã</h2>
        <form action={findRoomByCode} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Field label="Mã phòng (6 ký tự)" name="code" required maxLength={6} autoComplete="off" autoCapitalize="characters" />
          </div>
          <SubmitButton>Vào phòng</SubmitButton>
        </form>
      </Card>
      {rooms.length === 0 && (
        <Card className="space-y-3">
          <p className="text-lg">Chưa có phòng lô tô nào.</p>
          {isAdmin && <Link href="/admin/tro-choi" className={buttonClass}>Tạo phòng lô tô</Link>}
        </Card>
      )}
      {rooms.map((r) => (
        <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{r.title}</h2>
            <p className="text-base text-ink-soft">
              Mã <strong className="tracking-widest">{r.code}</strong> · {STATUS[r.status] ?? r.status} · Giải kinh {r.prize_points} điểm · {formatDateTime(r.created_at, tz)}
            </p>
          </div>
          <Link href={`/tro-choi/lo-to/${r.id}`} className={buttonClass}>{r.status === "waiting" || r.status === "playing" ? "Vào phòng" : "Xem lại"}</Link>
        </Card>
      ))}
    </>
  );
}
