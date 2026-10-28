"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cardsError, composeSchema } from "@/lib/cards";
import { getMyTimezone } from "@/lib/cards-server";
import { parseAmountToMinor } from "@/lib/cards-money";
import { zonedLocalToUtc } from "@/lib/cards-tz";
import type { FormState } from "@/lib/schemas";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/** Gửi thiệp mới, hoặc sửa thiệp đang hẹn giờ (khi có cardId). Quyền và dữ liệu được DB kiểm tra lại. */
export async function saveCard(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const cardId = str(formData.get("cardId"));
  if (cardId && !z.uuid().safeParse(cardId).success) return { error: "Thiệp không hợp lệ." };

  const parsed = composeSchema.safeParse({
    templateKey: str(formData.get("templateKey")),
    title: str(formData.get("title")),
    message: str(formData.get("message")),
    audienceKind: str(formData.get("audienceKind")),
    userIds: formData.getAll("userIds").map(String),
    branchId: str(formData.get("branchId")),
    when: str(formData.get("when")) || "now",
    scheduledLocal: str(formData.get("scheduledLocal")) || undefined,
    withGift: formData.get("withGift") === "on",
    giftAmount: str(formData.get("giftAmount")),
    giftCurrency: str(formData.get("giftCurrency")) || "VND",
    giftNote: str(formData.get("giftNote")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  const v = parsed.data;

  // Giờ hẹn: đổi theo múi giờ của NGƯỜI GỬI lấy từ hồ sơ trên máy chủ (không tin múi giờ do trình duyệt gửi)
  let scheduled: string | null = null;
  if (v.when === "later") {
    const tz = await getMyTimezone(session.userId);
    const at = v.scheduledLocal ? zonedLocalToUtc(v.scheduledLocal, tz) : null;
    if (!at) return { error: "Ngày giờ hẹn chưa hợp lệ." };
    if (at.getTime() < Date.now() - 60_000) return { error: "Giờ hẹn đã qua. Hãy chọn một thời điểm trong tương lai hoặc chọn \"Gửi ngay\"." };
    if (at.getTime() > Date.now()) scheduled = at.toISOString();
  }

  const supabase = await createClient();
  const common = {
    p_template: v.templateKey,
    p_title: v.title,
    p_message: v.message,
    p_audience_kind: v.audienceKind,
    p_user_ids: v.audienceKind === "users" ? v.userIds : [],
    p_branch: v.audienceKind === "branch" ? v.branchId : null,
    p_scheduled: scheduled,
  };

  let id = cardId;
  if (cardId) {
    const { error } = await supabase.rpc("update_card", { p_card: cardId, ...common });
    if (error) return { error: cardsError(error) };
  } else {
    const amountMinor = v.withGift && v.giftAmount ? parseAmountToMinor(v.giftAmount, v.giftCurrency) : null;
    const { data, error } = await supabase.rpc("send_card", {
      p_family: session.familyId,
      ...common,
      p_with_gift: v.withGift,
      p_gift_amount: amountMinor,
      p_gift_currency: amountMinor ? v.giftCurrency : null,
      p_gift_note: v.withGift ? (v.giftNote ?? null) : null,
    });
    if (error || typeof data !== "string") return { error: cardsError(error) || "Không gửi được thiệp. Vui lòng thử lại." };
    id = data;
  }
  revalidatePath("/thiep");
  revalidatePath("/li-xi");
  const msg = scheduled ? "Đã lưu thiệp hẹn giờ. Người nhận sẽ thấy khi đến giờ." : cardId ? "Đã lưu thay đổi." : "Đã gửi thiệp.";
  redirect(`/thiep/${id}?ok=${encodeURIComponent(msg)}`);
}

export async function cancelCardAction(formData: FormData) {
  await requireSession();
  const id = str(formData.get("cardId"));
  if (!z.uuid().safeParse(id).success) redirect("/thiep?error=" + encodeURIComponent("Thiệp không hợp lệ."));
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_card", { p_card: id });
  if (error) redirect(`/thiep/${id}?error=${encodeURIComponent(cardsError(error))}`);
  revalidatePath("/thiep");
  revalidatePath("/li-xi");
  redirect("/thiep?tab=hen-gio&ok=" + encodeURIComponent("Đã huỷ thiệp."));
}

/** Người nhận mở thiệp: ghi nhận "đã mở" (một lần). Chỉ người nhận thật sự mới có tác dụng (DB kiểm tra). */
export async function markCardOpened(cardId: string): Promise<boolean> {
  await requireSession();
  if (!z.uuid().safeParse(cardId).success) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_card_opened", { p_card: cardId });
  if (!error) revalidatePath("/thiep");
  return !error && data === true;
}
