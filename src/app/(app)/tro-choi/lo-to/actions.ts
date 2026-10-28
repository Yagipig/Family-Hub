"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { backTo, rpcMessage } from "@/lib/games/server";
import { lotoClaimSchema, lotoCodeSchema, lotoJoinSchema, idSchema } from "@/lib/games/schemas";

const BASE = "/tro-choi/lo-to";
const roomUrl = (id: string) => `${BASE}/${id}`;

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
  const parsed = lotoJoinSchema.safeParse({ roomId: formData.get("roomId"), cards: formData.get("cards") });
  if (!parsed.success) return backTo(BASE, "error", parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("loto_join", { p_room: parsed.data.roomId, p_cards: parsed.data.cards });
  if (error) return backTo(roomUrl(parsed.data.roomId), "error", rpcMessage(error));
  revalidatePath(roomUrl(parsed.data.roomId));
  return backTo(roomUrl(parsed.data.roomId), "ok", `Bạn đã nhận ${parsed.data.cards} tờ lô tô. Chờ người hô số bắt đầu nhé!`);
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
  const r = data as { ok: boolean; points?: number; false_claims?: number };
  if (!r.ok) return backTo(url, "error", `Chưa đủ một hàng 5 số đã hô — chưa phải kinh. Kinh nhầm ${r.false_claims}/3 lần.`);
  return backTo(url, "ok", `KINH! Máy chủ đã xác nhận. Bạn thắng${r.points ? ` ${r.points} điểm vui` : ""}!`);
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
