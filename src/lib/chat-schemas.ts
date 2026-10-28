import { z } from "zod";
import { REASON_KEYS, type ReasonKind } from "./chat";

/** Schema zod cho Server Action (chạy ở máy chủ). Không import vào component chạy ở trình duyệt. */
export const idSchema = z.uuid();
export const groupSchema = z.object({
  title: z.string().trim().min(1, "Vui lòng nhập tên nhóm.").max(100, "Tên nhóm tối đa 100 ký tự."),
  members: z.array(z.uuid()).min(1, "Hãy chọn ít nhất một người vào nhóm.").max(99, "Một nhóm tối đa 100 người."),
});
export const renameSchema = z.object({ title: z.string().trim().min(1, "Vui lòng nhập tên nhóm.").max(100, "Tên nhóm tối đa 100 ký tự.") });
export const reportSchema = z.object({
  reason: z.enum(REASON_KEYS as [ReasonKind, ...ReasonKind[]]),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự.").optional(),
});
export const resolveSchema = z.object({
  report: z.uuid(),
  action: z.enum(["dismiss", "hide_message", "remove_member", "hide_and_remove"]),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự.").optional(),
});
