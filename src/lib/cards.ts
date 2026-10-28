import { z } from "zod";
import { friendlyError } from "./format";
import { isTemplateKey } from "./card-templates";
import { SUPPORTED_CURRENCIES, parseAmountToMinor } from "./cards-money";
import { findCardNumber } from "./payout";

/** Dòng chữ bắt buộc hiển thị ở mọi nơi có lì xì / thông tin nhận tiền. */
export const NO_MONEY_NOTICE =
  "Family Hub không chuyển tiền; chỉ ghi nhận lời chúc và trạng thái do người dùng tự xác nhận.";

export type GiftStatus = "pledged" | "sender_marked_sent" | "recipient_confirmed" | "cancelled" | "disputed";
export const GIFT_STATUS_LABEL: Record<GiftStatus, string> = {
  pledged: "Đã hẹn (chưa chuyển)",
  sender_marked_sent: "Người gửi báo đã chuyển",
  recipient_confirmed: "Người nhận đã xác nhận",
  cancelled: "Đã huỷ",
  disputed: "Người nhận báo chưa nhận được",
};
export type GiftAction = "mark_sent" | "cancel" | "confirm" | "dispute";

/** Những việc mỗi bên được làm ở mỗi trạng thái (giao diện chỉ ẩn/hiện nút; DB mới là nơi quyết định). */
export function giftActionsFor(status: GiftStatus, role: "sender" | "recipient"): GiftAction[] {
  if (role === "sender") {
    if (status === "pledged" || status === "disputed") return ["mark_sent", "cancel"];
    return [];
  }
  if (status === "sender_marked_sent") return ["confirm", "dispute"];
  if (status === "disputed") return ["confirm"];
  return [];
}
export const GIFT_ACTION_LABEL: Record<GiftAction, string> = {
  mark_sent: "Tôi đã chuyển",
  cancel: "Huỷ lì xì này",
  confirm: "Tôi đã nhận được",
  dispute: "Tôi chưa nhận được",
};

export type AudienceKind = "users" | "branch" | "family";

export type Audience = {
  user_id: string;
  display_name: string;
  branch_id: string | null;
  branch_name: string | null;
  timezone: string;
  country_code: string | null;
};

const uuid = z.uuid();
const codePoints = (s: string) => [...s].length;

const optionalUuid = z.union([z.literal(""), uuid]).transform((v) => v || null);

export const giftNoteSchema = z
  .string()
  .trim()
  .max(500, "Ghi chú tối đa 500 ký tự.")
  .refine((v) => !findCardNumber(v), "Ghi chú có dãy số giống số thẻ. Đừng nhập số thẻ vào Family Hub.")
  .transform((v) => v || null);

export const composeSchema = z
  .object({
    templateKey: z.string().refine(isTemplateKey, "Hãy chọn một mẫu thiệp."),
    title: z.string().trim().max(120, "Tiêu đề tối đa 120 ký tự.").transform((v) => v || null),
    message: z
      .string()
      .transform((v) => v.replace(/\r\n/g, "\n").trim())
      .refine((v) => codePoints(v) >= 1, "Hãy viết lời chúc.")
      .refine((v) => codePoints(v) <= 2000, "Lời chúc tối đa 2000 ký tự."),
    audienceKind: z.enum(["users", "branch", "family"]),
    userIds: z.array(uuid).max(200, "Tối đa 200 người nhận mỗi thiệp."),
    branchId: optionalUuid,
    when: z.enum(["now", "later"]),
    scheduledLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Hãy chọn ngày giờ gửi.").optional(),
    withGift: z.boolean(),
    giftAmount: z.string().trim().max(30).optional().default(""),
    giftCurrency: z.string().optional().default("VND"),
    giftNote: giftNoteSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.audienceKind === "users" && v.userIds.length === 0)
      ctx.addIssue({ code: "custom", path: ["userIds"], message: "Hãy chọn ít nhất một người nhận." });
    if (v.audienceKind === "branch" && !v.branchId)
      ctx.addIssue({ code: "custom", path: ["branchId"], message: "Hãy chọn nhánh họ." });
    if (v.when === "later" && !v.scheduledLocal)
      ctx.addIssue({ code: "custom", path: ["scheduledLocal"], message: "Hãy chọn ngày giờ gửi." });
    if (v.withGift) {
      if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(v.giftCurrency))
        ctx.addIssue({ code: "custom", path: ["giftCurrency"], message: "Loại tiền chưa được hỗ trợ." });
      else if (v.giftAmount && parseAmountToMinor(v.giftAmount, v.giftCurrency) === null)
        ctx.addIssue({ code: "custom", path: ["giftAmount"], message: "Số tiền chưa hợp lệ (ví dụ: 500.000)." });
      if (v.audienceKind !== "users" || v.userIds.length > 20)
        ctx.addIssue({ code: "custom", path: ["withGift"], message: "Chỉ đính kèm lì xì khi chọn từng người, tối đa 20 người." });
    }
  });
export type ComposeInput = z.infer<typeof composeSchema>;

export const standaloneGiftSchema = z.object({
  recipientId: uuid,
  amount: z.string().trim().max(30).optional().default(""),
  currency: z.string().refine((c) => (SUPPORTED_CURRENCIES as readonly string[]).includes(c), "Loại tiền chưa được hỗ trợ."),
  note: giftNoteSchema.optional(),
}).superRefine((v, ctx) => {
  if (v.amount && parseAmountToMinor(v.amount, v.currency) === null)
    ctx.addIssue({ code: "custom", path: ["amount"], message: "Số tiền chưa hợp lệ (ví dụ: 500.000)." });
});

/** Lỗi từ RPC của module thiệp/lì xì -> thông báo tiếng Việt, không lộ chi tiết nội bộ. */
export function cardsError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "";
  const m = error.message ?? "";
  if (/recipient_limit/.test(m)) return "Mỗi thiệp gửi tối đa 200 người. Hãy chọn ít người hơn.";
  if (/no_recipients/.test(m)) return "Chưa có người nhận hợp lệ (bạn không thể gửi thiệp cho chính mình).";
  if (/rate_limit/.test(m)) return "Bạn đã gửi khá nhiều trong 24 giờ qua. Hãy thử lại sau.";
  if (/schedule_too_far/.test(m)) return "Chỉ hẹn giờ được trong vòng một năm tới.";
  if (/card_already_delivered/.test(m)) return "Thiệp đã đến giờ gửi nên không sửa được nữa.";
  if (/card_has_gifts/.test(m)) return "Thiệp đã kèm lì xì nên không đổi được người nhận. Hãy huỷ thiệp và tạo lại nếu cần.";
  if (/gift_recipient_limit/.test(m)) return "Chỉ đính kèm lì xì khi gửi tối đa 20 người.";
  if (/invalid transition/.test(m)) return "Trạng thái hiện tại không cho phép thao tác này (có thể người kia vừa cập nhật). Hãy tải lại trang.";
  if (/profile_limit/.test(m)) return "Bạn đã có tối đa 10 thông tin nhận tiền. Hãy xoá bớt trước khi thêm.";
  if (/not an active family member|bad share target|cannot gift yourself/.test(m)) return "Người nhận không hợp lệ (cần là thành viên đang hoạt động, không phải chính bạn).";
  if (/message length/.test(m)) return "Lời chúc cần từ 1 đến 2000 ký tự.";
  if (/unknown template/.test(m)) return "Mẫu thiệp không tồn tại.";
  if (error.code === "P0002") return "Không tìm thấy mục này (có thể đã bị xoá).";
  return friendlyError(error);
}
