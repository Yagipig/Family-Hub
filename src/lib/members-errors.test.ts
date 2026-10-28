import { describe, expect, it } from "vitest";
import { memberError } from "./members-errors";

describe("memberError", () => {
  const cases: [{ code?: string; message?: string }, RegExp][] = [
    [{ code: "P0001", message: "parent link would create a cycle" }, /vòng lặp/],
    [{ code: "P0001", message: "a member can have at most two biological parents" }, /tối đa hai cha mẹ ruột/],
    [{ code: "P0001", message: "relationship already exists" }, /đã có rồi/],
    [{ code: "P0001", message: "a parent and child cannot be partners" }, /không thể là vợ chồng/],
    [{ code: "P0001", message: "member is linked to an active account; unlink first" }, /gắn với một tài khoản/],
    [{ code: "42501", message: "forbidden" }, /không có quyền/],
    [{ code: "P0002", message: "member not found" }, /Không tìm thấy/],
    [{ code: "23505", message: 'duplicate key value violates unique constraint "family_memberships_member_unique"' }, /gắn với một tài khoản khác/],
    [{ code: "23505", message: "duplicate key" }, /đã tồn tại/],
    [{ code: "23514", message: "check constraint" }, /chưa hợp lệ/],
    [{ code: "22023", message: "full_name is required" }, /họ tên/],
    [{ code: "22023", message: "parent link refers to an unknown member" }, /không có trong tệp/],
    [{ code: "22023", message: "too many members (max 2000)" }, /2000/],
    [{ code: "22P02", message: "invalid input syntax for type uuid" }, /chưa hợp lệ/],
  ];
  for (const [err, re] of cases) {
    it(`${err.code} ${err.message}`, () => expect(memberError(err)).toMatch(re));
  }
  it("không lộ chi tiết nội bộ cho lỗi lạ", () => {
    const m = memberError({ code: "XX000", message: 'relation "family_members" does not exist at /var/lib/pg' });
    expect(m).not.toMatch(/family_members|pg/);
    expect(m).toMatch(/Không thực hiện được/);
  });
  it("không có lỗi => chuỗi rỗng", () => expect(memberError(null)).toBe(""));
  it("không nhầm lẫn: P0001 'last active super_admin' dùng thông báo chung", () => {
    expect(memberError({ code: "P0001", message: "cannot remove the last active super_admin" })).toMatch(/Super Admin cuối cùng/);
  });
});
