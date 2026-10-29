import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { gamesAccess } from "@/lib/games/server";
import { resolveCoin } from "@/lib/coins";
import { Alert, Card, Field, buttonClass, buttonGhostClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { GamesBanner } from "@/components/GamesBanner";
import { GamesAutoRefresh } from "@/components/GamesAutoRefresh";
import { createProvinceRoom, findRoomByCode } from "./actions";

export const metadata = { title: "Lô tô" };

const STATUS: Record<string, string> = { waiting: "Đang chờ người chơi", playing: "Đang hô số", paused: "Tạm dừng", finished: "Đã kết thúc", cancelled: "Đã hủy" };

export default async function LotoHome({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireSession();
  const { ok, error } = await searchParams;
  const access = await gamesAccess(session);
  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Lô tô</h1>
      <GamesBanner coinName={resolveCoin(access.settings).name} />
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {access.state !== "ok" ? (
        <Card className="space-y-3">
          <p className="text-lg">{access.state === "off" ? "Trò chơi đang tạm tắt." : "Tài khoản khách không tham gia trò chơi."}</p>
          <Link href="/tro-choi" className={buttonGhostClass}>Về trang trò chơi</Link>
        </Card>
      ) : (
        <Rooms tz={session.timezone} isAdmin={access.isAdmin} coin={resolveCoin(access.settings)} userId={session.userId} />
      )}
    </>
  );
}

async function Rooms({ tz, isAdmin, coin, userId }: { tz: string; isAdmin: boolean; coin: ReturnType<typeof resolveCoin>; userId: string }) {
  const coinLower = coin.name.toLocaleLowerCase("vi-VN");
  const supabase = await createClient();
  // Dọn phòng trống: phòng chờ nào không có người chơi nào sau 5 phút thì tự hủy
  // (RPC chạy phía máy chủ; lỗi nếu có cũng bỏ qua để sảnh vẫn hiện bình thường).
  await supabase.rpc("loto_cleanup_empty_rooms");
  const { data } = await supabase.from("loto_rooms").select("id, title, code, status, prize_points, created_at, mode, win_rows, code_required, host_user, created_by")
    .order("created_at", { ascending: false }).limit(8);
  const rooms = (data ?? []) as Array<{ id: string; title: string; code: string; status: string; prize_points: number; created_at: string; mode: string; win_rows: number; code_required: boolean; host_user: string | null; created_by: string | null }>;
  const { data: inv } = rooms.length
    ? await supabase.from("loto_invites").select("room_id").eq("user_id", userId).in("room_id", rooms.map((r) => r.id))
    : { data: [] };
  const invitedRooms = new Set(((inv ?? []) as Array<{ room_id: string }>).map((i) => i.room_id));
  return (
    <>
      <GamesAutoRefresh seconds={8} active={rooms.some((r) => r.status === "waiting" || r.status === "playing" || r.status === "paused")} />
      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Vào phòng bằng mã</h2>
        <form action={findRoomByCode} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Field label="Mã phòng (6 ký tự)" name="code" required maxLength={6} autoComplete="off" autoCapitalize="characters" />
          </div>
          <SubmitButton>Vào phòng</SubmitButton>
        </form>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Tạo phòng lô tô truyền thống (63 tỉnh)</h2>
        <p className="text-base text-ink-soft">
          Người tạo phòng sẽ là <strong>chủ phòng</strong>: hô số, tạm dừng, hoàn tác, chuyển quyền cho người khác.
          Mỗi người chơi chọn một bảng cố định theo tỉnh/thành (bản đồ 63 tỉnh cũ), bảng chọn rồi sẽ khóa.
        </p>
        <form action={createProvinceRoom} className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên phòng" name="title" required maxLength={120} placeholder="Ví dụ: Lô tô tối mùng 1 nhà mình" />
          <Field label={`Giải kinh (tổng, bằng ${coin.name.toLocaleLowerCase("vi-VN")})`} name="prize" type="number" min={0} max={500} defaultValue={50} required />
          <div>
            <label className="mb-1 block text-base font-semibold" htmlFor="winRows">Luật thắng (chốt khi tạo phòng)</label>
            <select id="winRows" name="winRows" defaultValue="1" className="min-h-12 w-full rounded-xl border border-ink-soft/40 bg-white px-3 text-lg">
              <option value="1">Đủ 1 hàng ngang</option>
              <option value="2">Đủ 2 hàng ngang</option>
              <option value="3">Đủ cả 3 hàng (kinh lớn)</option>
            </select>
          </div>
          <div className="space-y-2 pt-6">
            <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
              <input type="checkbox" name="autoWin" defaultChecked className="h-6 w-6" /> Tự động phát hiện người thắng sau mỗi số
            </label>
            <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
              <input type="checkbox" name="allowChange" className="h-6 w-6" /> Cho người chơi đổi bảng trước khi bắt đầu
            </label>
            <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
              <input type="checkbox" name="codeRequired" defaultChecked className="h-6 w-6" /> Yêu cầu mã phòng để tham gia (người được mời vào thẳng; bỏ chọn = phòng mở, ai cũng vào được)
            </label>
          </div>
          <div><SubmitButton>Tạo phòng — tôi làm chủ phòng</SubmitButton></div>
        </form>
      </Card>
      {rooms.length === 0 && (
        <Card className="space-y-3">
          <p className="text-lg">Chưa có phòng lô tô nào.</p>
          {isAdmin && <Link href="/admin/tro-choi" className={buttonClass}>Tạo phòng lô tô</Link>}
        </Card>
      )}
      {rooms.map((r) => {
        const mine = (r.host_user ?? r.created_by) === userId;
        const invited = invitedRooms.has(r.id);
        return (
        <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{r.title}</h2>
            <p className="text-base text-ink-soft">
              {(mine || isAdmin) && r.code_required ? <>Mã <strong className="tracking-widest">{r.code}</strong> · </> : null}
              {!r.code_required ? <>Phòng mở (không cần mã) · </> : null}
              {r.code_required && !mine && !isAdmin ? <>{invited ? <><strong className="text-wine">Bạn được mời</strong> · </> : <>Cần mã phòng · </>}</> : null}
              {STATUS[r.status] ?? r.status}{r.mode === "province" ? ` · Truyền thống 63 tỉnh · thắng ${r.win_rows} hàng` : ""} · Giải kinh {r.prize_points} {coinLower} · {formatDateTime(r.created_at, tz)}
            </p>
          </div>
          <Link href={`/tro-choi/lo-to/${r.id}`} className={buttonClass}>{r.status === "waiting" || r.status === "playing" ? "Vào phòng" : "Xem lại"}</Link>
        </Card>
        );
      })}
    </>
  );
}
