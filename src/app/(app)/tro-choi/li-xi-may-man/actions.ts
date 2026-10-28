"use server";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { backTo, rpcMessage } from "@/lib/games/server";
import { idSchema } from "@/lib/games/schemas";
import { revalidatePath } from "next/cache";

const BASE = "/tro-choi/li-xi-may-man";

export async function drawLixi(formData: FormData) {
  const session = await requireSession();
  void session;
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return backTo(BASE, "error", "Bao lì xì không hợp lệ.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lixi_draw", { p_packet: parsed.data.id });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  revalidatePath(BASE);
  revalidatePath("/tro-choi");
  return backTo(BASE, "ok", `Chúc mừng! Bạn bốc được ${data} điểm vui.`);
}
