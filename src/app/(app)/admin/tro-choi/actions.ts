"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { backTo, rpcMessage } from "@/lib/games/server";
import {
  bcRoomSchema, coinSchema, gameSettingsSchema, idSchema, lixiCreateSchema, lotoRoomSchema, lotteryOpenSchema, readLotteryPrizes,
} from "@/lib/games/schemas";
import { coinLabel, resolveCoin } from "@/lib/coins";
import { zonedLocalToUtc } from "@/lib/games/time";

const BASE = "/admin/tro-choi";
const done = (msg: string) => { revalidatePath(BASE); revalidatePath("/tro-choi"); return backTo(BASE, "ok", msg); };
const bad = (e: { issues: Array<{ message: string }> }) => backTo(BASE, "error", e.issues[0]?.message ?? "Thông tin chưa hợp lệ.");

export async function saveSettings(fd: FormData) {
  const session = await requireAdmin(BASE);
  const parsed = gameSettingsSchema.safeParse({
    enabled: fd.get("enabled") === "on", leaderboard: fd.get("leaderboard") === "on",
    startingPoints: fd.get("startingPoints"), dailyGift: fd.get("dailyGift"),
    bcMin: fd.get("bcMin"), bcMax: fd.get("bcMax"), bcRound: fd.get("bcRound"),
    lossCap: fd.get("lossCap"), winCap: fd.get("winCap"),
  });
  if (!parsed.success) return bad(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("games_save_settings", {
    p_family: session.familyId, p_enabled: v.enabled, p_leaderboard: v.leaderboard, p_start: v.startingPoints, p_gift: v.dailyGift,
    p_bc_min: v.bcMin, p_bc_max: v.bcMax, p_bc_round: v.bcRound, p_loss: v.lossCap, p_win: v.winCap,
  });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  return done(v.enabled ? "Đã lưu. Trò chơi đang BẬT cho cả gia đình." : "Đã lưu. Trò chơi đang TẮT.");
}

export async function saveCoin(fd: FormData) {
  const session = await requireAdmin(BASE);
  const parsed = coinSchema.safeParse({
    unit: fd.get("coinUnit"), customName: fd.get("coinCustomName") ?? "", customIcon: fd.get("coinCustomIcon") ?? "",
  });
  if (!parsed.success) return bad(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("games_set_coin", {
    p_family: session.familyId, p_unit: v.unit,
    p_name: v.unit === "custom" ? v.customName : null,
    p_icon: v.unit === "custom" ? v.customIcon : null,
  });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  const coin = resolveCoin({ coin_unit: v.unit, coin_custom_name: v.customName, coin_custom_icon: v.customIcon });
  return done(`Đã đổi đơn vị hiển thị trong trò chơi thành ${coinLabel(coin)}. Số dư của mọi người giữ nguyên.`);
}

export async function createLixi(fd: FormData) {
  const session = await requireAdmin(BASE);
  const parsed = lixiCreateSchema.safeParse({ title: fd.get("title"), prizes: fd.get("prizes"), closeHours: fd.get("closeHours") ?? 0 });
  if (!parsed.success) return bad(parsed.error);
  const closes = parsed.data.closeHours > 0 ? new Date(Date.now() + parsed.data.closeHours * 3600_000).toISOString() : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("lixi_create", {
    p_family: session.familyId, p_title: parsed.data.title, p_points: parsed.data.prizes, p_closes_at: closes,
  });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  return done("Đã tạo bao lì xì.");
}

export async function closeLixi(fd: FormData) {
  await requireAdmin(BASE);
  const p = idSchema.safeParse({ id: fd.get("id") });
  if (!p.success) return bad(p.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("lixi_close", { p_packet: p.data.id });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  return done("Đã đóng bao lì xì.");
}

export async function openLottery(fd: FormData) {
  const session = await requireAdmin(BASE);
  const parsed = lotteryOpenSchema.safeParse({
    title: fd.get("title"), drawAt: fd.get("drawAt"), price: fd.get("price"), free: fd.get("free"), max: fd.get("max"),
    prizes: readLotteryPrizes(fd),
  });
  if (!parsed.success) return bad(parsed.error);
  const v = parsed.data;
  for (const p of v.prizes) if (p.kind === "points" && !p.points) return backTo(BASE, "error", "Giải bằng điểm cần ghi số điểm (1–500).");
  const when = zonedLocalToUtc(v.drawAt, session.timezone);
  if (!when) return backTo(BASE, "error", "Ngày giờ quay không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("lottery_open", {
    p_family: session.familyId, p_title: v.title, p_draw_at: when.toISOString(), p_price: v.price, p_free: v.free, p_max: v.max,
    p_prizes: v.prizes.map((p) => ({ kind: p.kind, label: p.label, ...(p.kind === "points" ? { points: p.points } : {}) })),
  });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  return done("Đã mở kỳ quay số. Mã cam kết đã được công bố.");
}

async function byId(rpc: string, arg: string, fd: FormData, okMsg: string) {
  await requireAdmin(BASE);
  const p = idSchema.safeParse({ id: fd.get("id") });
  if (!p.success) return bad(p.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, { [arg]: p.data.id });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  return done(okMsg);
}
export async function runLotteryNow(fd: FormData) { return byId("lottery_run", "p_draw", fd, "Đã quay số."); }
export async function cancelLottery(fd: FormData) { return byId("lottery_cancel", "p_draw", fd, "Đã hủy kỳ quay và hoàn điểm vé."); }
export async function closeBcRoom(fd: FormData) { return byId("bc_close_room", "p_room", fd, "Đã đóng phòng bầu cua (cược đang chờ được hoàn lại)."); }

export async function createLotoRoom(fd: FormData) {
  const session = await requireAdmin(BASE);
  const parsed = lotoRoomSchema.safeParse({ title: fd.get("title"), prize: fd.get("prize") });
  if (!parsed.success) return bad(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("loto_create_room", { p_family: session.familyId, p_title: parsed.data.title, p_prize: parsed.data.prize });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  return done("Đã tạo phòng lô tô. Mã phòng hiển thị trong danh sách bên dưới.");
}

export async function openBcRoom(fd: FormData) {
  const session = await requireAdmin(BASE);
  const parsed = bcRoomSchema.safeParse({ title: fd.get("title") });
  if (!parsed.success) return bad(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("bc_open_room", { p_family: session.familyId, p_title: parsed.data.title });
  if (error) return backTo(BASE, "error", error.code === "23505" ? "Đang có một phòng bầu cua mở rồi. Hãy đóng phòng cũ trước." : rpcMessage(error));
  return done("Đã mở phòng bầu cua.");
}

/** Muc phat khi kinh sai trong lo to (0 = khong phat). */
export async function saveLotoPenalty(fd: FormData) {
  const session = await requireAdmin(BASE);
  const raw = Number(fd.get("lotoPenalty"));
  if (!Number.isInteger(raw) || raw < 0 || raw > 100) return backTo(BASE, "error", "Mức phạt kinh sai phải là số nguyên từ 0 đến 100.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("games_set_loto_penalty", { p_family: session.familyId, p_penalty: raw });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  return done(raw > 0 ? `Đã đặt mức phạt kinh sai: ${raw} xu mỗi lần.` : "Đã tắt phạt kinh sai.");
}

/** Giong ho + nhac nen lo to (dot 2): link nhac, tan suat cau vui, cau ho rieng cua gia dinh. */
export async function saveLotoAudio(fd: FormData) {
  const session = await requireAdmin(BASE);
  const musicUrl = String(fd.get("musicUrl") ?? "").trim();
  const chatter = Number(fd.get("chatter"));
  if (!Number.isInteger(chatter) || chatter < 0 || chatter > 100) return backTo(BASE, "error", "Tần suất câu hô vui phải là số nguyên từ 0 đến 100.");
  if (musicUrl && (musicUrl.length > 500 || !/^https?:\/\//i.test(musicUrl))) return backTo(BASE, "error", "Đường dẫn nhạc phải bắt đầu bằng http:// hoặc https:// và tối đa 500 ký tự.");
  const lines = String(fd.get("extraLines") ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 30);
  if (lines.some((l) => l.length > 200)) return backTo(BASE, "error", "Mỗi câu hô riêng tối đa 200 ký tự.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("games_set_loto_audio", {
    p_family: session.familyId, p_music_url: musicUrl || null, p_chatter: chatter, p_extra_lines: lines,
  });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  return done("Đã lưu cấu hình giọng hô & nhạc nền lô tô.");
}
