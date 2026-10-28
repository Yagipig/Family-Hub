"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { displayNameSchema, type FormState } from "@/lib/schemas";

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = displayNameSchema.safeParse({ displayName: formData.get("displayName") });
  if (!parsed.success) return { error: "Tên hiển thị không hợp lệ." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", session.userId);
  if (error) return { error: "Không lưu được. Vui lòng thử lại." };
  revalidatePath("/", "layout");
  return { ok: "Đã lưu." };
}
