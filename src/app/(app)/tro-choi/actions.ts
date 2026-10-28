"use server";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { backTo, rpcMessage } from "@/lib/games/server";
import { revalidatePath } from "next/cache";

const BASE = "/tro-choi";

export async function claimDailyGift() {
  const session = await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_daily_gift", { p_family: session.familyId });
  if (error) return backTo(BASE, "error", rpcMessage(error));
  revalidatePath(BASE);
  return backTo(BASE, "ok", `Bạn nhận được ${data} điểm vui hôm nay. Chúc bạn một ngày vui!`);
}
