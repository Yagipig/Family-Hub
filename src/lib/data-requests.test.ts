import { describe, expect, it } from "vitest";
import { changedKeys, handleDataRequestSchema, submitDataRequestSchema } from "./data-requests";

describe("data-requests", () => {
  it("changedKeys chỉ trả tên khóa đã đổi và bỏ updated_at", () => {
    expect(changedKeys({ a: 1, b: 2, updated_at: "x" }, { a: 1, b: 3, c: 4, updated_at: "y" })).toEqual(["b", "c"]);
    expect(changedKeys(null, { x: 1 })).toEqual(["x"]);
    expect(changedKeys({ x: { y: 1 } }, { x: { y: 1 } })).toEqual([]);
  });
  it("schema từ chối loại và trạng thái lạ", () => {
    expect(submitDataRequestSchema.safeParse({ kind: "hack" }).success).toBe(false);
    expect(submitDataRequestSchema.safeParse({ kind: "export", note: "x".repeat(1001) }).success).toBe(false);
    expect(submitDataRequestSchema.safeParse({ kind: "delete" }).success).toBe(true);
    expect(handleDataRequestSchema.safeParse({ id: "00000000-0000-0000-0000-000000000001", status: "cancelled" }).success).toBe(false);
  });
});
