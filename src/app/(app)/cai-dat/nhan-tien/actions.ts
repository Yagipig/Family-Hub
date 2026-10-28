"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cardsError } from "@/lib/cards";
import { payoutInputSchema, type PayoutSecret } from "@/lib/payout";
import { createPayoutProfile, revealPayoutProfile } from "@/lib/payout-server";
import type { FormState } from "@/lib/schemas";

const BASE = "/cai-dat/nhan-tien";
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const back = (to: string, kind: "ok" | "error", msg: string): never => {
  const sep = to.includes("?") ? "&" : "?";
  return redirect(`${to}${sep}${kind}=${encodeURIComponent(msg)}`);
};

export async function addPayoutProfile(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = payoutInputSchema.safeParse({
    kind: str(formData.get("kind")), label: str(formData.get("label")), holder: str(formData.get("holder")),
    number: str(formData.get("number")), note: str(formData.get("note")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  const res = await createPayoutProfile(session.familyId, session.userId, parsed.data);
  if (!res.ok) return { error: res.error };
  revalidatePath(BASE);
  return { ok: "Đã lưu (đã mã hóa). Mặc định thông tin được che và chưa chia sẻ cho ai." };
}

export async function deletePayoutProfileAction(formData: FormData) {
  await requireSession();
  const id = str(formData.get("profileId"));
  if (!z.uuid().safeParse(id).success) return back(BASE, "error", "Mục không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_payout_profile", { p_profile: id });
  if (error) return back(BASE, "error", cardsError(error));
  revalidatePath(BASE);
  return back(BASE, "ok", "Đã xoá thông tin nhận tiền và mọi lượt chia sẻ của nó.");
}

const shareSchema = z.object({
  profileId: z.uuid(), userId: z.uuid(),
  hours: z.coerce.number().int().min(1).max(720),
});

/** Chia sẻ một hồ sơ cho MỘT người cụ thể, có hạn dùng. `back` chỉ nhận đường dẫn nội bộ. */
export async function sharePayout(formData: FormData) {
  await requireSession();
  // Chỉ chấp nhận đường dẫn nội bộ đơn giản (chặn "//", "/\\", ký tự lạ)
  const rawBack = str(formData.get("back"));
  const to = /^\/[A-Za-z0-9\-_/]*$/.test(rawBack) && !rawBack.startsWith("//") && rawBack.length > 1 ? rawBack : BASE;
  const parsed = shareSchema.safeParse({ profileId: str(formData.get("profileId")), userId: str(formData.get("userId")), hours: str(formData.get("hours")) });
  if (!parsed.success) return back(to, "error", "Hãy chọn thông tin nhận tiền, người được xem và thời hạn.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("share_payout_profile", { p_profile: parsed.data.profileId, p_user: parsed.data.userId, p_hours: parsed.data.hours });
  if (error) return back(to, "error", cardsError(error));
  revalidatePath(BASE);
  revalidatePath("/li-xi");
  return back(to, "ok", "Đã chia sẻ có thời hạn. Bạn có thể thu hồi bất cứ lúc nào.");
}

export async function revokePayoutShare(formData: FormData) {
  await requireSession();
  const id = str(formData.get("shareId"));
  if (!z.uuid().safeParse(id).success) return back(BASE, "error", "Mục không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_payout_share", { p_share: id });
  if (error) return back(BASE, "error", cardsError(error));
  revalidatePath(BASE);
  revalidatePath("/li-xi");
  return back(BASE, "ok", "Đã thu hồi. Người đó không xem được nữa.");
}

export type RevealResult = { ok: true; secret: PayoutSecret } | { ok: false; error: string };

/** Gọi từ nút "Hiện thông tin". Mỗi lần gọi đều được DB ghi nhật ký payout.reveal. */
export async function revealPayoutAction(profileId: string): Promise<RevealResult> {
  await requireSession();
  if (!z.uuid().safeParse(profileId).success) return { ok: false, error: "Mục không hợp lệ." };
  return revealPayoutProfile(profileId);
}
