"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rpcMessage } from "@/lib/games/server";
import { z } from "zod";

const schema = z.object({
  roomId: z.uuid(),
  action: z.enum(["loto_next", "loto_start", "lottery_run", "bc_roll", "bc_new_round"]),
  targetId: z.uuid().optional(),
});

export type TvResult = { ok: boolean; message: string };

/**
 * Dieu khien cho nguoi dan chuong trinh tren man hinh TV (phim/nut lon). Khong can thao tac nao khac tu nguoi xem.
 * Quyen that su do CSDL kiem tra: nguoi khong phai quan tri se bi tu choi o ham SQL.
 */
export async function tvControl(input: { roomId: string; action: string; targetId?: string }): Promise<TvResult> {
  await requireSession();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Thao tác không hợp lệ." };
  const { roomId, action, targetId } = parsed.data;
  const supabase = await createClient();
  let res;
  switch (action) {
    case "loto_start": res = await supabase.rpc("loto_start", { p_room: roomId }); break;
    case "loto_next": res = await supabase.rpc("loto_call_next", { p_room: roomId }); break;
    case "lottery_run": res = await supabase.rpc("lottery_run", { p_draw: roomId }); break;
    case "bc_roll": res = targetId ? await supabase.rpc("bc_roll", { p_round: targetId }) : { error: { message: "not_found", code: "P0002" } }; break;
    case "bc_new_round": res = await supabase.rpc("bc_new_round", { p_room: roomId, p_seconds: 60 }); break;
  }
  if (res.error) return { ok: false, message: rpcMessage(res.error) };
  revalidatePath(`/tro-choi/tv/${roomId}`);
  return { ok: true, message: "Đã thực hiện." };
}
