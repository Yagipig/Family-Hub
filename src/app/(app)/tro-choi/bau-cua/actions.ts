"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { backTo, rpcMessage } from "@/lib/games/server";
import { bcBetSchema, idSchema } from "@/lib/games/schemas";

const BASE = "/tro-choi/bau-cua";

/** Moi lan chi dat them mot khoan vao mot o. Khong co "dat lai" hay "gap doi". */
export async function placeBet(formData: FormData) {
  await requireSession();
  const parsed = bcBetSchema.safeParse({ roundId: formData.get("roundId"), symbol: formData.get("symbol"), amount: formData.get("amount") });
  if (!parsed.success) return backTo(BASE, "error", parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("bc_place_bet", {
    p_round: parsed.data.roundId, p_symbol: parsed.data.symbol, p_amount: parsed.data.amount,
  });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  revalidatePath(BASE);
  return backTo(BASE, "ok", "Đã đặt cược.");
}

/** Lac xuc xac: quan tri bat ky luc nao; thanh vien khi da het gio dat cuoc (CSDL kiem tra). */
export async function rollRound(formData: FormData) {
  await requireSession();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return backTo(BASE, "error", "Ván không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("bc_roll", { p_round: parsed.data.id });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  revalidatePath(BASE);
  revalidatePath("/tro-choi");
  return backTo(BASE, "ok", "Đã lắc xúc xắc!");
}

export async function newRound(formData: FormData) {
  await requireSession();
  const roomId = String(formData.get("roomId") ?? "");
  const seconds = Number(formData.get("seconds") ?? 60);
  const parsed = idSchema.safeParse({ id: roomId });
  if (!parsed.success || !Number.isInteger(seconds)) return backTo(BASE, "error", "Thông tin chưa hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("bc_new_round", { p_room: parsed.data.id, p_seconds: seconds });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  revalidatePath(BASE);
  return backTo(BASE, "ok", "Đã mở ván mới. Mời cả nhà đặt cược!");
}
