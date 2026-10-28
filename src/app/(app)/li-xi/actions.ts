"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cardsError, standaloneGiftSchema } from "@/lib/cards";
import { parseAmountToMinor } from "@/lib/cards-money";

const BASE = "/li-xi";
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const back = (kind: "ok" | "error", msg: string): never => redirect(`${BASE}?${kind}=${encodeURIComponent(msg)}`);

const transitionSchema = z.object({
  giftId: z.uuid(),
  action: z.enum(["mark_sent", "cancel", "confirm", "dispute"]),
  note: z.string().trim().max(500).optional(),
});

const DONE: Record<string, string> = {
  mark_sent: "Đã ghi nhận: bạn đã chuyển. Người nhận sẽ được nhắc kiểm tra và xác nhận.",
  cancel: "Đã huỷ lì xì.",
  confirm: "Đã ghi nhận: bạn đã nhận được. Cảm ơn bạn!",
  dispute: "Đã báo là chưa nhận được. Người gửi sẽ được nhắc kiểm tra lại.",
};

/** Chuyển trạng thái lì xì. Không có bước nào chạm tiền: chỉ ghi nhận điều người dùng tự xác nhận. DB quyết định ai được làm gì. */
export async function giftTransitionAction(formData: FormData) {
  await requireSession();
  const parsed = transitionSchema.safeParse({ giftId: str(formData.get("giftId")), action: str(formData.get("action")), note: str(formData.get("note")) });
  if (!parsed.success) return back("error", "Thao tác không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("gift_transition", { p_gift: parsed.data.giftId, p_action: parsed.data.action, p_note: parsed.data.note || null });
  if (error) return back("error", cardsError(error));
  revalidatePath(BASE);
  return back("ok", DONE[parsed.data.action]);
}

export async function createGiftAction(formData: FormData) {
  const session = await requireSession();
  const parsed = standaloneGiftSchema.safeParse({
    recipientId: str(formData.get("recipientId")), amount: str(formData.get("amount")),
    currency: str(formData.get("currency")) || "VND", note: str(formData.get("note")),
  });
  if (!parsed.success) return back("error", parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
  const v = parsed.data;
  const amountMinor = v.amount ? parseAmountToMinor(v.amount, v.currency) : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_gift", {
    p_family: session.familyId, p_recipient: v.recipientId,
    p_amount_minor: amountMinor, p_currency: amountMinor ? v.currency : null, p_note: v.note ?? null,
  });
  if (error) return back("error", cardsError(error));
  revalidatePath(BASE);
  return back("ok", "Đã hẹn lì xì (chỉ ghi nhận). Bạn tự chuyển tiền ngoài Family Hub rồi quay lại bấm “Tôi đã chuyển”.");
}
