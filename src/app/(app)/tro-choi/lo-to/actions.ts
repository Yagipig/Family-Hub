"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { backTo, rpcMessage } from "@/lib/games/server";
import { grantRequestSchema, lotoBoardClaimSchema, lotoBotsSchema, lotoClaimSchema, lotoCodeSchema, lotoEnterCodeSchema, lotoInviteSchema, lotoJoinSchema, lotoProvinceCreateSchema, idSchema } from "@/lib/games/schemas";

const BASE = "/tro-choi/lo-to";
const roomUrl = (id: string) => `${BASE}/${id}`;

/** Ma phong da nhap dung duoc nho bang cookie (chi dung de gui lai cho RPC kiem tra o may chu). */
const codeCookieName = (roomId: string) => `fh-loto-code-${roomId}`;
async function roomCodeFromCookie(roomId: string): Promise<string | null> {
  try { return (await cookies()).get(codeCookieName(roomId))?.value ?? null; } catch { return null; }
}

export async function findRoomByCode(formData: FormData) {
  const session = await requireSession();
  const parsed = lotoCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return backTo(BASE, "error", parsed.error.issues[0]?.message ?? "Mã phòng chưa đúng.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("loto_find_room", { p_family: session.familyId, p_code: parsed.data.code });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  if (!data) return backTo(BASE, "error", "Không tìm thấy phòng với mã này (hoặc phòng đã kết thúc).");
  return redirect(roomUrl(data as string));
}

export async function joinRoom(formData: FormData) {
  await requireSession();
  const parsed = lotoJoinSchema.safeParse({ roomId: formData.get("roomId"), cards: formData.get("cards"), stake: formData.get("stake") });
  if (!parsed.success) return backTo(BASE, "error", parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("loto_join", {
    p_room: parsed.data.roomId, p_cards: parsed.data.cards,
    p_room_code: await roomCodeFromCookie(parsed.data.roomId),
    p_stake: parsed.data.stake,
  });
  if (error) return backTo(roomUrl(parsed.data.roomId), "error", rpcMessage(error));
  revalidatePath(roomUrl(parsed.data.roomId));
  return backTo(roomUrl(parsed.data.roomId), "ok", `Bạn đã nhận ${parsed.data.cards} tờ lô tô với mức cược ${parsed.data.stake.toLocaleString("vi-VN")}. Chờ người hô số bắt đầu nhé!`);
}

/** Nhap ma phong: may chu kiem tra; dung thi nho bang cookie de cac buoc tham gia sau khoi nhap lai. */
export async function enterRoomCode(formData: FormData) {
  await requireSession();
  const parsed = lotoEnterCodeSchema.safeParse({ roomId: formData.get("roomId"), code: formData.get("code") });
  if (!parsed.success) return backTo(BASE, "error", parsed.error.issues[0]?.message ?? "Mã phòng chưa đúng.");
  const url = roomUrl(parsed.data.roomId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("loto_check_code", { p_room: parsed.data.roomId, p_code: parsed.data.code });
  if (error) return backTo(url, "error", rpcMessage(error));
  if (!data) return backTo(url, "error", "Mã phòng chưa đúng. Bạn kiểm tra lại mã chủ phòng đưa nhé.");
  (await cookies()).set(codeCookieName(parsed.data.roomId), parsed.data.code, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12,
  });
  return backTo(url, "ok", "Đã mở khóa phòng. Bạn chọn bảng và tham gia nhé!");
}

/** "Kinh!": may chu kiem tra bang cac so da ho that; khong tin dau danh dau cua may nguoi choi. */
export async function claimKinh(formData: FormData) {
  await requireSession();
  const parsed = lotoClaimSchema.safeParse({ roomId: formData.get("roomId"), cardId: formData.get("cardId") });
  if (!parsed.success) return backTo(BASE, "error", "Tờ lô tô không hợp lệ.");
  const url = roomUrl(parsed.data.roomId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("loto_claim_kinh", { p_room: parsed.data.roomId, p_card: parsed.data.cardId });
  if (error) return backTo(url, "error", rpcMessage(error));
  revalidatePath(url);
  const r = data as { ok: boolean; points?: number; false_claims?: number; rows?: number; need?: number; penalty?: number; winners?: number };
  if (!r.ok) {
    const need = r.need ?? 1;
    return backTo(url, "error",
      `Chưa đủ ${need} hàng (mới đủ ${r.rows ?? 0}/${need} hàng) — chưa phải kinh. Kinh nhầm ${r.false_claims}/3 lần.${r.penalty ? ` Bị trừ ${r.penalty} xu phạt kinh sai.` : ""}`);
  }
  return backTo(url, "ok",
    `KINH RỒI NHÉ! Máy chủ đã xác nhận${r.winners && r.winners > 1 ? ` — có ${r.winners} người cùng thắng lượt này, giải được chia đều` : ""}. Bạn nhận ${r.points ?? 0} xu!`);
}

// ---- Quan tri (nguoi ho so): CSDL kiem tra lai quyen ----
async function adminCall(fn: string, formData: FormData, okMsg: string) {
  await requireSession();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return backTo(BASE, "error", "Phòng không hợp lệ.");
  const url = roomUrl(parsed.data.id);
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_room: parsed.data.id });
  if (error) return backTo(url, "error", rpcMessage(error));
  revalidatePath(url);
  return backTo(url, "ok", okMsg);
}
export async function startRoom(fd: FormData) { return adminCall("loto_start", fd, "Đã bắt đầu ván. Bắt đầu hô số!"); }
export async function callNext(fd: FormData) { return adminCall("loto_call_next", fd, "Đã hô số tiếp theo."); }
export async function endRoom(fd: FormData) { return adminCall("loto_end", fd, "Đã kết thúc phòng."); }

// ---- Lo to truyen thong: phong tinh, chu phong la nguoi tao ----

/** Tao phong truyen thong (63 bang tinh). Nguoi tao tu dong la chu phong. */
export async function createProvinceRoom(formData: FormData) {
  const session = await requireSession();
  const parsed = lotoProvinceCreateSchema.safeParse({
    title: formData.get("title"), prize: formData.get("prize"), winRows: formData.get("winRows"),
    autoWin: formData.get("autoWin") != null, allowChange: formData.get("allowChange") != null,
    codeRequired: formData.get("codeRequired") != null,
  });
  if (!parsed.success) return backTo(BASE, "error", parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("loto_create_province_room", {
    p_family: session.familyId, p_title: parsed.data.title, p_prize: parsed.data.prize,
    p_win_rows: parsed.data.winRows, p_auto_win: parsed.data.autoWin, p_allow_change: parsed.data.allowChange,
    p_code_required: parsed.data.codeRequired,
  });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  return redirect(roomUrl(data as string));
}

/** Chon bang tinh (khoa o may chu) kem muc cuoc tru vao vi. */
export async function claimBoard(formData: FormData) {
  await requireSession();
  const parsed = lotoBoardClaimSchema.safeParse({ roomId: formData.get("roomId"), code: formData.get("code"), stake: formData.get("stake") });
  if (!parsed.success) return backTo(BASE, "error", parsed.error.issues[0]?.message ?? "Bảng hoặc mức cược chưa hợp lệ.");
  const url = roomUrl(parsed.data.roomId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("loto_claim_board", {
    p_room: parsed.data.roomId, p_code: parsed.data.code,
    p_room_code: await roomCodeFromCookie(parsed.data.roomId),
    p_stake: parsed.data.stake,
  });
  if (error) return backTo(url, "error", rpcMessage(error));
  revalidatePath(url);
  return backTo(url, "ok", `Đã chọn bảng với mức cược ${parsed.data.stake.toLocaleString("vi-VN")}! Bảng đã khóa cho bạn, chờ chủ phòng bắt đầu ván nhé.`);
}

/** Nha bang (chi khi chu phong cho phep doi bang va van chua bat dau). */
export async function releaseBoard(formData: FormData) {
  await requireSession();
  const parsed = idSchema.safeParse({ id: formData.get("roomId") });
  if (!parsed.success) return backTo(BASE, "error", "Phòng không hợp lệ.");
  const url = roomUrl(parsed.data.id);
  const supabase = await createClient();
  const { error } = await supabase.rpc("loto_release_board", { p_room: parsed.data.id });
  if (error) return backTo(url, "error", rpcMessage(error));
  revalidatePath(url);
  return backTo(url, "ok", "Đã nhả bảng. Bạn chọn bảng tỉnh khác nhé!");
}

// ---- Dieu khien cua chu phong (CSDL kiem tra lai quyen chu phong/admin) ----
async function hostCall(fn: string, formData: FormData, okMsg: string) {
  await requireSession();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return backTo(BASE, "error", "Phòng không hợp lệ.");
  const url = roomUrl(parsed.data.id);
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_room: parsed.data.id });
  if (error) return backTo(url, "error", rpcMessage(error));
  revalidatePath(url);
  return backTo(url, "ok", okMsg);
}
export async function pauseRoom(fd: FormData) { return hostCall("loto_pause", fd, "Đã tạm dừng ván."); }
export async function resumeRoom(fd: FormData) { return hostCall("loto_resume", fd, "Đã tiếp tục ván."); }
export async function undoCallRoom(fd: FormData) { return hostCall("loto_undo_call", fd, "Đã hoàn tác số vừa hô."); }
export async function transferHostRandom(fd: FormData) { return hostCall("loto_transfer_host", fd, "Đã chuyển quyền chủ phòng cho một người chơi ngẫu nhiên."); }

// ---- Moi thanh vien + cong ma phong (Cach 2: ma la cong that o may chu) ----

/** Chu phong moi thanh vien: nguoi duoc moi nhan thong bao va vao thang, khoi nhap ma. */
export async function inviteMembers(formData: FormData) {
  await requireSession();
  const parsed = lotoInviteSchema.safeParse({
    roomId: formData.get("roomId"),
    userIds: formData.getAll("userId").map(String),
  });
  if (!parsed.success) return backTo(BASE, "error", parsed.error.issues[0]?.message ?? "Danh sách mời chưa hợp lệ.");
  const url = roomUrl(parsed.data.roomId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("loto_invite", { p_room: parsed.data.roomId, p_users: parsed.data.userIds });
  if (error) return backTo(url, "error", rpcMessage(error));
  revalidatePath(url);
  const n = typeof data === "number" ? data : 0;
  return backTo(url, "ok", n > 0 ? `Đã mời ${n} người. Họ sẽ nhận thông báo và vào phòng không cần mã.` : "Những người này đã được mời rồi.");
}

/** Bo moi mot nguoi (chi co tac dung voi nguoi chua tham gia). */
export async function uninviteMember(formData: FormData) {
  await requireSession();
  const roomId = String(formData.get("roomId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(roomId) || !/^[0-9a-f-]{36}$/.test(userId)) return backTo(BASE, "error", "Thông tin chưa hợp lệ.");
  const url = roomUrl(roomId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("loto_uninvite", { p_room: roomId, p_user: userId });
  if (error) return backTo(url, "error", rpcMessage(error));
  revalidatePath(url);
  return backTo(url, "ok", "Đã bỏ lời mời.");
}

/** Chu phong bat/tat yeu cau ma phong (chi khi phong dang cho). */
export async function setCodeRequired(formData: FormData) {
  await requireSession();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return backTo(BASE, "error", "Phòng không hợp lệ.");
  const url = roomUrl(parsed.data.id);
  const required = formData.get("required") === "1";
  const supabase = await createClient();
  const { error } = await supabase.rpc("loto_set_code_required", { p_room: parsed.data.id, p_required: required });
  if (error) return backTo(url, "error", rpcMessage(error));
  revalidatePath(url);
  return backTo(url, "ok", required
    ? "Đã BẬT yêu cầu mã phòng: người chưa được mời phải nhập mã mới tham gia được."
    : "Đã TẮT mã phòng: ai trong gia đình cũng tham gia được, không cần mã.");
}

// ---- Bot choi thay nguoi (chu phong quan ly khi phong dang cho) ----

/** Them bot vao phong: moi bot chon 1 bang tinh con trong (hoac 1 to ngau nhien o phong co dien). */
export async function addBots(formData: FormData) {
  await requireSession();
  const parsed = lotoBotsSchema.safeParse({ roomId: formData.get("roomId"), count: formData.get("count") });
  if (!parsed.success) return backTo(BASE, "error", parsed.error.issues[0]?.message ?? "Số bot chưa hợp lệ.");
  const url = roomUrl(parsed.data.roomId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("loto_add_bots", { p_room: parsed.data.roomId, p_count: parsed.data.count });
  if (error) return backTo(url, "error", rpcMessage(error));
  revalidatePath(url);
  const n = typeof data === "number" ? data : 0;
  return backTo(url, "ok", n > 0
    ? `Đã thêm ${n} bot vào phòng. Bot sẽ tự dò số và kinh như người thật.`
    : "Không thêm được bot nào (có thể đã hết bảng trống).");
}

/** Xoa mot bot khoi phong (khi phong dang cho). */
export async function removeBot(formData: FormData) {
  await requireSession();
  const roomId = String(formData.get("roomId") ?? "");
  const cardId = String(formData.get("cardId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(roomId) || !/^[0-9a-f-]{36}$/.test(cardId)) return backTo(BASE, "error", "Thông tin chưa hợp lệ.");
  const url = roomUrl(roomId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("loto_remove_bot", { p_room: roomId, p_card: cardId });
  if (error) return backTo(url, "error", rpcMessage(error));
  revalidatePath(url);
  return backTo(url, "ok", "Đã xóa bot khỏi phòng.");
}

// ---- Xin cap la (admin duyet thi tien vao vi) ----

/** Gui yeu cau xin cap theo menh gia; quay lai phong dang xem. */
export async function requestGrant(formData: FormData) {
  const session = await requireSession();
  const roomId = String(formData.get("roomId") ?? "");
  const back = /^[0-9a-f-]{36}$/.test(roomId) ? roomUrl(roomId) : BASE;
  const parsed = grantRequestSchema.safeParse({ amount: formData.get("amount") });
  if (!parsed.success) return backTo(back, "error", parsed.error.issues[0]?.message ?? "Mệnh giá chưa hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("points_request_grant", { p_family: session.familyId, p_amount: parsed.data.amount });
  if (error) return backTo(back, "error", rpcMessage(error));
  revalidatePath(back);
  return backTo(back, "ok", `Đã gửi yêu cầu cấp ${parsed.data.amount.toLocaleString("vi-VN")} lá. Admin duyệt xong tiền sẽ vào ví của bạn.`);
}

/** Huy yeu cau cap dang cho duyet cua chinh minh. */
export async function cancelGrant(formData: FormData) {
  await requireSession();
  const requestId = String(formData.get("requestId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const back = /^[0-9a-f-]{36}$/.test(roomId) ? roomUrl(roomId) : BASE;
  if (!/^[0-9a-f-]{36}$/.test(requestId)) return backTo(back, "error", "Yêu cầu không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("points_cancel_grant", { p_request: requestId });
  if (error) return backTo(back, "error", rpcMessage(error));
  revalidatePath(back);
  return backTo(back, "ok", "Đã hủy yêu cầu cấp lá.");
}
