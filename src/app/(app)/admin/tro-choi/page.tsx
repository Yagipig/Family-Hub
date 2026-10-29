import Link from "next/link";
import { can, requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { GameSettings } from "@/lib/games/server";
import { noticeFor } from "@/lib/games/notice";
import { Alert, Card, Field, SelectField, buttonClass, buttonGhostClass } from "@/components/ui";
import { SubmitButton, ConfirmButton } from "@/components/SubmitButton";
import {
  cancelLottery, closeBcRoom, closeLixi, createLixi, createLotoRoom, openBcRoom, openLottery, runLotteryNow, saveCoin, saveLotoAudio, saveLotoPenalty, saveSettings,
} from "./actions";
import { COIN_UNITS, CUSTOM_COIN_ICONS, CUSTOM_COIN_KEY, coinLabel, resolveCoin } from "@/lib/coins";

export const metadata = { title: "Quản trị trò chơi" };

const dangerBtn = "inline-flex min-h-12 items-center justify-center rounded-xl border border-danger px-5 py-2 text-base font-semibold text-danger hover:bg-red-50";

export default async function GamesAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireAdmin("/admin/tro-choi");
  const { ok, error } = await searchParams;
  const allowed = await can(session, "games", "update");
  const supabase = await createClient();
  const { data: sd } = await supabase.from("game_settings").select("*").eq("family_id", session.familyId).maybeSingle();
  const s = (sd as GameSettings | null) ?? null;
  const coin = resolveCoin(s);
  const coinLower = coin.name.toLocaleLowerCase("vi-VN");

  if (!allowed) {
    return (
      <>
        <h1 className="text-3xl font-bold text-wine">Quản trị trò chơi</h1>
        <Card><p className="text-lg">Chỉ Super Admin và Quản trị gia đình mới quản lý được trò chơi. Bạn vẫn xem được các trò chơi khi chúng được bật.</p></Card>
      </>
    );
  }

  const [{ data: pk }, { data: dr }, { data: lr }, { data: rm }, { data: ldr }] = await Promise.all([
    supabase.from("lixi_packets").select("id, title, status, prize_count, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("lottery_draws").select("id, title, status, draw_at, ticket_count").order("created_at", { ascending: false }).limit(5),
    supabase.from("loto_rooms").select("id, title, code, status, prize_points").order("created_at", { ascending: false }).limit(5),
    supabase.from("bc_rooms").select("id, title").eq("status", "open").maybeSingle(),
    supabase.from("lixi_draws").select("packet_id").limit(1000),
  ]);
  const packets = (pk ?? []) as Array<{ id: string; title: string; status: string; prize_count: number }>;
  const drawCount = new Map<string, number>();
  for (const d of (ldr ?? []) as Array<{ packet_id: string }>) drawCount.set(d.packet_id, (drawCount.get(d.packet_id) ?? 0) + 1);
  const draws = (dr ?? []) as Array<{ id: string; title: string; status: string; draw_at: string; ticket_count: number }>;
  const rooms = (lr ?? []) as Array<{ id: string; title: string; code: string; status: string; prize_points: number }>;
  const bcRoom = rm as { id: string; title: string } | null;

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Quản trị trò chơi</h1>
      <p role="note" className="rounded-xl border border-champagne bg-champagne-soft px-4 py-3 text-base font-semibold text-wine-dark">
        {noticeFor(coin.name)}. Mọi trò chơi chỉ dùng {coinLower} ảo, không nạp, không rút, không đổi ra tiền.
      </p>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Bật / tắt và giới hạn</h2>
        <p className="text-base text-ink-soft">Trò chơi mặc định TẮT cho tới khi bạn bật. Tắt lại bất cứ lúc nào: mọi người sẽ không chơi được nữa ({coinLower} vẫn được giữ).</p>
        <form action={saveSettings} className="grid gap-4 sm:grid-cols-2">
          <label className="flex min-h-12 items-center gap-3 text-lg font-semibold">
            <input type="checkbox" name="enabled" className="h-7 w-7" defaultChecked={s?.enabled ?? false} /> Bật trò chơi cho cả gia đình
          </label>
          <label className="flex min-h-12 items-center gap-3 text-lg font-semibold">
            <input type="checkbox" name="leaderboard" className="h-7 w-7" defaultChecked={s?.leaderboard_enabled ?? true} /> Hiện bảng xếp hạng
          </label>
          <Field label={`${coin.name} khởi đầu (0–1000)`} name="startingPoints" type="number" min={0} max={1000} defaultValue={s?.starting_points ?? 100} required />
          <Field label={`Quà hằng ngày (0–100 ${coinLower}, 0 = tắt)`} name="dailyGift" type="number" min={0} max={100} defaultValue={s?.daily_gift ?? 10} required />
          <Field label="Bầu cua: cược tối thiểu" name="bcMin" type="number" min={1} max={100} defaultValue={s?.bc_min_bet ?? 1} required />
          <Field label="Bầu cua: cược tối đa mỗi ô" name="bcMax" type="number" min={1} max={200} defaultValue={s?.bc_max_bet ?? 20} required />
          <Field label="Bầu cua: tổng cược tối đa mỗi ván" name="bcRound" type="number" min={1} max={500} defaultValue={s?.bc_max_round_total ?? 50} required />
          <Field label="Bầu cua: thua tối đa mỗi ngày (tự khóa tới ngày mai)" name="lossCap" type="number" min={1} max={1000} defaultValue={s?.bc_daily_loss_cap ?? 100} required />
          <Field label="Bầu cua: thắng tối đa mỗi ngày (tự khóa tới ngày mai)" name="winCap" type="number" min={1} max={5000} defaultValue={s?.bc_daily_win_cap ?? 300} required />
          <div className="sm:col-span-2"><SubmitButton>Lưu cài đặt</SubmitButton></div>
        </form>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Loại xu của gia đình</h2>
        <p className="text-base text-ink-soft">
          Đang dùng: <strong>{coinLabel(coin)}</strong>. Chọn một loại xu vui để gọi thay cho &ldquo;điểm&rdquo; trong mọi trò chơi
          (số dư, quà hằng ngày, giải thưởng, bảng xếp hạng...). Chỉ đổi tên gọi — số dư của mọi người giữ nguyên, đổi qua lại lúc nào cũng được.
        </p>
        <form action={saveCoin} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {COIN_UNITS.map((u) => (
              <label key={u.key} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-champagne/60 px-4 py-2 text-lg font-semibold has-checked:border-wine has-checked:bg-champagne-soft">
                <input type="radio" name="coinUnit" value={u.key} className="h-6 w-6" defaultChecked={coin.key === u.key} />
                <span>{u.icon ? `${u.icon} ${u.name}` : u.name}</span>
              </label>
            ))}
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-champagne/60 px-4 py-2 text-lg font-semibold has-checked:border-wine has-checked:bg-champagne-soft">
              <input type="radio" name="coinUnit" value={CUSTOM_COIN_KEY} className="h-6 w-6" defaultChecked={coin.key === CUSTOM_COIN_KEY} />
              <span>✏️ Tự đặt tên</span>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên xu tự đặt (khi chọn Tự đặt tên)" name="coinCustomName" maxLength={30} defaultValue={s?.coin_custom_name ?? ""} placeholder="Ví dụ: Bắp, Ốc, Sò..." />
            <SelectField label="Biểu tượng cho xu tự đặt" name="coinCustomIcon" defaultValue={s?.coin_custom_icon ?? "🪙"}>
              {CUSTOM_COIN_ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </SelectField>
          </div>
          <SubmitButton>Lưu loại xu</SubmitButton>
        </form>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Lô tô truyền thống — phạt kinh sai</h2>
        <p className="text-base text-ink-soft">
          Khi người chơi bấm &ldquo;Kinh rồi nhé!&rdquo; mà bảng chưa đủ điều kiện thắng, có thể trừ một ít xu làm phạt
          (trừ tối đa bằng số dư hiện có, và mỗi người tối đa 3 lần kinh sai mỗi ván). Đặt 0 để không phạt.
        </p>
        <form action={saveLotoPenalty} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48">
            <Field label="Mức phạt mỗi lần kinh sai (xu)" name="lotoPenalty" type="number" min={0} max={100} defaultValue={String(s?.loto_false_penalty ?? 0)} />
          </div>
          <SubmitButton>Lưu mức phạt</SubmitButton>
        </form>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Lô tô truyền thống — giọng hô & nhạc nền</h2>
        <p className="text-base text-ink-soft">
          Giọng hô dùng giọng đọc tiếng Việt có sẵn trong trình duyệt của mỗi người chơi (ai muốn nghe thì bấm bật trong phòng).
          Câu hô vui sẽ xen kẽ câu &ldquo;Số n&rdquo; theo tần suất bạn đặt. Nhạc nền phát từ một đường dẫn tệp nhạc (mp3...)
          trên mạng; khi giọng hô đang đọc, nhạc tự nhỏ xuống.
        </p>
        <form action={saveLotoAudio} className="grid gap-4 sm:grid-cols-2">
          <Field label="Đường dẫn nhạc nền (để trống = không dùng nhạc)" name="musicUrl" maxLength={500} defaultValue={s?.loto_music_url ?? ""} placeholder="https://.../nhac-lo-to.mp3" />
          <Field label="Tần suất câu hô vui (0–100%)" name="chatter" type="number" min={0} max={100} defaultValue={String(s?.loto_chatter ?? 60)} />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-base font-semibold" htmlFor="extraLines">Câu hô riêng của nhà mình (mỗi câu một dòng, tối đa 30 câu, nhớ để {"{n}"} là chỗ con số)</label>
            <textarea
              id="extraLines" name="extraLines" rows={4} maxLength={6000}
              defaultValue={(s?.loto_extra_lines ?? []).join("\n")}
              placeholder={"Ví dụ: Nhà mình ơi, ra số {n} rồi nè!"}
              className="w-full rounded-xl border border-ink-soft/40 bg-white px-3 py-2 text-base"
            />
          </div>
          <div className="sm:col-span-2"><SubmitButton>Lưu giọng hô & nhạc</SubmitButton></div>
        </form>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">63 bảng tỉnh của lô tô truyền thống</h2>
        <p className="text-base text-ink-soft">
          Xem và sửa bộ số của từng bảng tỉnh: đảo bộ số mới, hoặc xếp lại bố cục giữ nguyên 15 số.
          Mọi thay đổi có lưu lịch sử để khôi phục, và chỉ áp dụng cho các ván sau (bảng người chơi đã chọn không đổi).
        </p>
        <Link href="/admin/tro-choi/bang-lo-to" className={buttonClass}>Mở trình sửa 63 bảng tỉnh</Link>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Lì xì may mắn</h2>
        <form action={createLixi} className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên bao lì xì" name="title" required maxLength={120} placeholder="Lì xì đêm giao thừa" />
          <Field label={`Các phần thưởng (${coinLower}, cách nhau bằng dấu phẩy)`} name="prizes" required placeholder="5, 10, 10, 20, 50" hint={`Mỗi phần 1–500 ${coinLower}, tối đa 50 phần. Mỗi người bốc một lần, kết quả do máy chủ quyết định.`} />
          <Field label="Tự đóng sau (giờ, 0 = không hẹn)" name="closeHours" type="number" min={0} max={1440} defaultValue={0} />
          <div className="self-end"><SubmitButton>Tạo bao lì xì</SubmitButton></div>
        </form>
        <ul className="divide-y divide-champagne/50 text-base">
          {packets.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span><strong>{p.title}</strong> — {drawCount.get(p.id) ?? 0}/{p.prize_count} đã bốc · {p.status === "open" ? "đang mở" : "đã đóng"}</span>
              {p.status === "open" && (
                <form action={closeLixi}><input type="hidden" name="id" value={p.id} />
                  <ConfirmButton message="Đóng bao lì xì này?" className={dangerBtn}>Đóng bao</ConfirmButton></form>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Xổ số gia đình (quay số vui)</h2>
        <p className="text-base text-ink-soft">
          Khi mở kỳ quay, hệ thống tạo seed bí mật và công bố mã cam kết (SHA-256). Sau khi quay, seed được tiết lộ để mọi người kiểm chứng.
          Giờ quay tính theo múi giờ gia đình: <strong>{session.timezone}</strong>. Giải thưởng là {coinLower}, lời chúc hoặc vật phẩm vui — không phải tiền.
        </p>
        <form action={openLottery} className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên kỳ quay" name="title" required maxLength={120} placeholder="Quay số đầu năm" />
          <Field label="Giờ quay" name="drawAt" type="datetime-local" required />
          <Field label={`Giá vé sau vé miễn phí (0–50 ${coinLower})`} name="price" type="number" min={0} max={50} defaultValue={5} required />
          <Field label="Số vé miễn phí mỗi người (0–3)" name="free" type="number" min={0} max={3} defaultValue={1} required />
          <Field label="Tối đa vé mỗi người (1–5)" name="max" type="number" min={1} max={5} defaultValue={3} required />
          <div className="sm:col-span-2 space-y-3">
            <p className="text-base font-semibold">Các giải (theo thứ tự giải 1, 2, 3…; để trống tên nếu không dùng)</p>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="grid gap-3 sm:grid-cols-3">
                <SelectField label={`Giải ${n}: loại`} name="prizeKind" defaultValue={n === 1 ? "points" : "wish"}>
                  <option value="points">{coin.name} vui</option><option value="wish">Lời chúc</option><option value="item">Vật phẩm vui</option>
                </SelectField>
                <Field label="Tên giải" name="prizeLabel" maxLength={120} defaultValue={n === 1 ? "Giải nhất" : n === 2 ? "Giải nhì" : n === 3 ? "Giải ba" : ""} />
                <Field label={`Số ${coinLower} (nếu là ${coinLower})`} name="prizePoints" type="number" min={1} max={500} defaultValue={n === 1 ? 50 : n === 2 ? 20 : n === 3 ? 10 : ""} />
              </div>
            ))}
          </div>
          <div className="sm:col-span-2"><SubmitButton>Mở kỳ quay</SubmitButton></div>
        </form>
        <ul className="divide-y divide-champagne/50 text-base">
          {draws.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span><strong>{d.title}</strong> — {d.status === "open" ? "đang nhận vé" : d.status === "drawn" ? "đã quay" : "đã hủy"} · {d.ticket_count} vé · {formatDateTime(d.draw_at, session.timezone)}</span>
              <span className="flex flex-wrap gap-2">
                <Link href={`/tro-choi/tv/${d.id}`} className={buttonGhostClass}>Chiếu TV</Link>
                {d.status === "open" && (
                  <>
                    <form action={runLotteryNow}><input type="hidden" name="id" value={d.id} /><ConfirmButton message="Quay số ngay bây giờ?" className={buttonClass}>Quay số ngay</ConfirmButton></form>
                    <form action={cancelLottery}><input type="hidden" name="id" value={d.id} /><ConfirmButton message={`Hủy kỳ quay và trả lại ${coinLower} mua vé cho mọi người?`} className={dangerBtn}>Hủy kỳ</ConfirmButton></form>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Lô tô (bạn là người hô số)</h2>
        <form action={createLotoRoom} className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên phòng" name="title" required maxLength={120} placeholder="Lô tô tối mùng 1" />
          <Field label={`Giải kinh (0–500 ${coinLower})`} name="prize" type="number" min={0} max={500} defaultValue={50} required />
          <div className="sm:col-span-2"><SubmitButton>Tạo phòng lô tô</SubmitButton></div>
        </form>
        <ul className="divide-y divide-champagne/50 text-base">
          {rooms.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span><strong>{r.title}</strong> — mã <strong className="tracking-widest">{r.code}</strong> · {r.status === "waiting" ? "chờ người chơi" : r.status === "playing" ? "đang hô số" : r.status === "finished" ? "đã kết thúc" : "đã hủy"}</span>
              <span className="flex gap-2">
                <Link href={`/tro-choi/lo-to/${r.id}`} className={buttonGhostClass}>Điều khiển</Link>
                <Link href={`/tro-choi/tv/${r.id}`} className={buttonGhostClass}>Chiếu TV</Link>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Bầu cua tôm cá</h2>
        {bcRoom ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg">Đang mở phòng: <strong>{bcRoom.title}</strong></p>
            <span className="flex flex-wrap gap-2">
              <Link href="/tro-choi/bau-cua" className={buttonClass}>Vào phòng (mở ván)</Link>
              <Link href={`/tro-choi/tv/${bcRoom.id}`} className={buttonGhostClass}>Chiếu TV</Link>
              <form action={closeBcRoom}><input type="hidden" name="id" value={bcRoom.id} />
                <ConfirmButton message="Đóng phòng? Cược đang chờ sẽ được hoàn lại." className={dangerBtn}>Đóng phòng</ConfirmButton></form>
            </span>
          </div>
        ) : (
          <form action={openBcRoom} className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1"><Field label="Tên phòng" name="title" required maxLength={120} placeholder="Bầu cua đêm giao thừa" /></div>
            <SubmitButton>Mở phòng</SubmitButton>
          </form>
        )}
      </Card>
    </>
  );
}
