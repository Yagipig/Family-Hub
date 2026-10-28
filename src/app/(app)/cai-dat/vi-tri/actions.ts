"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { findCountry } from "@/lib/countries";
import { isValidTimeZone } from "@/lib/tz";
import type { FormState } from "@/lib/schemas";

export async function saveLocation(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const country = String(formData.get("country") ?? "").toUpperCase();
  const timezone = String(formData.get("timezone") ?? "");
  if (country && !findCountry(country)) return { error: "Quốc gia chưa hợp lệ." };
  if (!isValidTimeZone(timezone)) return { error: "Múi giờ chưa hợp lệ." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ country_code: country || null, timezone })
    .eq("id", session.userId);
  if (error) return { error: "Không lưu được. Múi giờ có thể chưa được hệ thống hỗ trợ." };
  revalidatePath("/", "layout");
  return { ok: "Đã lưu. Giờ trên lịch và thông báo sẽ theo múi giờ mới của bạn." };
}
