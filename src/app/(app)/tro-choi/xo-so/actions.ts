"use server";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { backTo, rpcMessage } from "@/lib/games/server";
import { idSchema } from "@/lib/games/schemas";
import { revalidatePath } from "next/cache";

const BASE = "/tro-choi/xo-so";

export async function getTicket(formData: FormData) {
  await requireSession();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return backTo(BASE, "error", "Kỳ quay không hợp lệ.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lottery_get_ticket", { p_draw: parsed.data.id });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  revalidatePath(BASE);
  revalidatePath("/tro-choi");
  return backTo(BASE, "ok", `Bạn đã nhận vé số ${data}. Chúc bạn may mắn!`);
}

/** Quay so: quan tri bam bat ky luc nao; thanh vien khi da toi gio (CSDL kiem tra). */
export async function runLottery(formData: FormData) {
  await requireSession();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return backTo(BASE, "error", "Kỳ quay không hợp lệ.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lottery_run", { p_draw: parsed.data.id });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  revalidatePath(BASE);
  revalidatePath("/tro-choi");
  return backTo(BASE, "ok", `Đã quay số xong. Có ${data} giải được trao.`);
}
