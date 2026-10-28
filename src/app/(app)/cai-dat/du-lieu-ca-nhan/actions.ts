"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { submitDataRequestSchema } from "@/lib/data-requests";
import { z } from "zod";

const BASE = "/cai-dat/du-lieu-ca-nhan";
const back = (kind: "ok" | "error", msg: string): never => redirect(`${BASE}?${kind}=${encodeURIComponent(msg)}`);

export async function submitRequest(formData: FormData) {
  const session = await requireSession();
  const parsed = submitDataRequestSchema.safeParse({ kind: formData.get("kind"), note: formData.get("note") ?? "" });
  if (!parsed.success) return back("error", parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_data_request", { p_family: session.familyId, p_kind: parsed.data.kind, p_note: parsed.data.note || null });
  if (error) return back("error", error.code === "P0001" ? "Bạn đang có quá nhiều yêu cầu chưa xử lý (tối đa 5)." : "Không gửi được yêu cầu. Vui lòng thử lại.");
  revalidatePath(BASE);
  return back("ok", "Đã gửi yêu cầu. Quản trị viên sẽ xử lý và báo lại cho bạn.");
}

export async function cancelRequest(formData: FormData) {
  await requireSession();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return back("error", "Yêu cầu không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_data_request", { p_id: id.data });
  if (error) return back("error", "Không hủy được (yêu cầu có thể đã được xử lý).");
  revalidatePath(BASE);
  return back("ok", "Đã hủy yêu cầu.");
}
