"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { memberError } from "@/lib/members-errors";
import { idSchema } from "@/lib/members-schemas";

const BASE = "/thanh-vien/yeu-cau";
const back = (kind: "ok" | "error", msg: string): never => redirect(`${BASE}?${kind}=${encodeURIComponent(msg)}`);

export async function cancelRequestAction(formData: FormData) {
  await requireSession();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return back("error", "Yêu cầu không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_change_request", { p_id: id.data });
  if (error) return back("error", memberError(error));
  revalidatePath(BASE);
  return back("ok", "Đã hủy yêu cầu.");
}
