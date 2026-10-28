"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/format";
import type { FormState } from "@/lib/schemas";
import { parsePrefs } from "@/lib/notification-prefs";

export async function savePreferences(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = parsePrefs(formData);
  if (!parsed.ok) return { error: parsed.error };
  const v = parsed.value;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_notification_preferences", {
    p_family: session.familyId, p_birthdays: v.birthdays, p_lead: v.leads, p_death: v.death,
    p_events: v.events, p_cards: v.cards, p_gifts: v.gifts, p_chat: v.chat,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/cai-dat/thong-bao");
  return { ok: "Đã lưu tuỳ chọn thông báo." };
}
