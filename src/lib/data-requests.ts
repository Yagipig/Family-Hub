import { z } from "zod";

export const DATA_REQUEST_KINDS = ["export", "correct", "restrict", "delete"] as const;
export type DataRequestKind = (typeof DATA_REQUEST_KINDS)[number];
export const DATA_REQUEST_LABELS: Record<DataRequestKind, string> = {
  export: "Xin bản sao dữ liệu của tôi",
  correct: "Đề nghị sửa dữ liệu sai",
  restrict: "Đề nghị ẩn/hạn chế thông tin của tôi",
  delete: "Đề nghị xóa hồ sơ và dữ liệu của tôi",
};
export const DATA_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "Đang chờ", in_progress: "Đang xử lý", done: "Đã xử lý xong", rejected: "Bị từ chối", cancelled: "Đã hủy",
};

export const submitDataRequestSchema = z.object({
  kind: z.enum(DATA_REQUEST_KINDS, { error: "Hãy chọn loại yêu cầu." }),
  note: z.string().trim().max(1000, "Ghi chú tối đa 1000 ký tự.").default(""),
});
export const handleDataRequestSchema = z.object({
  id: z.uuid(),
  status: z.enum(["in_progress", "done", "rejected"]),
  note: z.string().trim().max(1000).default(""),
});

/** Các khóa thay đổi giữa hai bản ghi (chỉ tên khóa, KHÔNG lộ giá trị) — dùng cho trang nhật ký. */
export function changedKeys(before: unknown, after: unknown): string[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const skip = new Set(["updated_at"]);
  return [...keys].filter((k) => !skip.has(k) && JSON.stringify(b[k]) !== JSON.stringify(a[k])).sort();
}
