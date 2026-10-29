"use server";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rpcMessage } from "@/lib/games/server";
import { idSchema } from "@/lib/games/schemas";

type CallResult = { ok: true; number: number } | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

async function rpc(fn: string, roomId: string) {
  await requireSession();
  const parsed = idSchema.safeParse({ id: roomId });
  if (!parsed.success) return { data: null, error: { message: "bad_id" } as { message: string } };
  const supabase = await createClient();
  return supabase.rpc(fn, { p_room: parsed.data.id });
}

/** Ho mot so tiep theo; tra ve so vua ho de panel chu phong dieu phoi chuoi goi 1/3/5. */
export async function hostCallNext(roomId: string): Promise<CallResult> {
  const { data, error } = await rpc("loto_call_next", roomId);
  if (error) return { ok: false, error: rpcMessage(error) };
  return { ok: true, number: data as number };
}

/** Kiem tra tu dong nguoi thang sau moi luot ho (khi phong bat auto_win). */
export async function hostCheckWinners(roomId: string): Promise<{ winners: number }> {
  const { data, error } = await rpc("loto_check_winners", roomId);
  if (error) return { winners: 0 };
  return { winners: (data as number) ?? 0 };
}

export async function hostPauseRoom(roomId: string): Promise<SimpleResult> {
  const { error } = await rpc("loto_pause", roomId);
  return error ? { ok: false, error: rpcMessage(error) } : { ok: true };
}

export async function hostUndoCall(roomId: string): Promise<SimpleResult> {
  const { error } = await rpc("loto_undo_call", roomId);
  return error ? { ok: false, error: rpcMessage(error) } : { ok: true };
}
