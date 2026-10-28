"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/format";
import type { FormState } from "@/lib/schemas";
import { parseEventForm, rsvpSchema } from "@/lib/events";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function eventError(error: { code?: string; message?: string }): string {
  if (error.code === "P0001" && /too many events/.test(error.message ?? "")) return "Bạn đã tạo quá nhiều sự kiện trong 24 giờ. Vui lòng thử lại sau.";
  if (error.code === "P0001" && /cancelled/.test(error.message ?? "")) return "Sự kiện này đã huỷ nên không thể thay đổi.";
  if (error.code === "P0002") return "Không tìm thấy sự kiện (có thể đã bị xoá).";
  if (error.code === "42501") return "Bạn không có quyền thực hiện việc này. Nếu là thành viên, hãy nhờ quản trị viên mở chế độ chỉnh sửa.";
  return friendlyError(error);
}

export async function createEventAction(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = parseEventForm(Object.fromEntries(formData));
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_event", { p_family: session.familyId, p_data: parsed.payload });
  if (error || typeof data !== "string") return { error: error ? eventError(error) : "Không tạo được sự kiện." };
  revalidatePath("/lich");
  redirect(`/lich/su-kien/${data}`);
}

export async function updateEventAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const eventId = String(formData.get("eventId") ?? "");
  if (!UUID.test(eventId)) return { error: "Sự kiện không hợp lệ." };
  const parsed = parseEventForm(Object.fromEntries(formData));
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_event", { p_event: eventId, p_data: parsed.payload });
  if (error) return { error: eventError(error) };
  revalidatePath("/lich");
  redirect(`/lich/su-kien/${eventId}`);
}

export async function cancelEventAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const eventId = String(formData.get("eventId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!UUID.test(eventId)) return { error: "Sự kiện không hợp lệ." };
  if (reason.length > 500) return { error: "Lý do tối đa 500 ký tự." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_event", { p_event: eventId, p_reason: reason || null });
  if (error) return { error: eventError(error) };
  revalidatePath("/lich");
  revalidatePath(`/lich/su-kien/${eventId}`);
  return { ok: "Đã huỷ sự kiện. Những người đã trả lời tham dự sẽ nhận được thông báo." };
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  await requireSession();
  const eventId = String(formData.get("eventId") ?? "");
  if (!UUID.test(eventId)) redirect("/lich");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_event", { p_event: eventId });
  revalidatePath("/lich");
  if (error) redirect(`/lich/su-kien/${eventId}?loi=xoa`);
  redirect("/lich");
}

export async function rsvpAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const parsed = rsvpSchema.safeParse({
    eventId: formData.get("eventId"),
    occurrence: formData.get("occurrence"),
    response: formData.get("response"),
    guests: String(formData.get("guests") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_rsvp", {
    p_event: parsed.data.eventId, p_occurrence: parsed.data.occurrence, p_response: parsed.data.response,
    p_guests: parsed.data.response === "no" ? 0 : parsed.data.guests, p_note: parsed.data.note || null,
  });
  if (error) {
    if (error.code === "22023") return { error: "Không trả lời được: ngày này không có sự kiện hoặc đã qua." };
    if (error.code === "P0001") return { error: "Sự kiện này đã huỷ." };
    return { error: eventError(error) };
  }
  revalidatePath(`/lich/su-kien/${parsed.data.eventId}`);
  return { ok: "Đã ghi nhận câu trả lời của bạn." };
}
