import { describe, expect, it } from "vitest";
import { describeRequest, formatFieldValue, payloadChanges, referencedIds, type RequestContext } from "./members-requests";
import type { ChangeRequestRow } from "./members-types";

const A = "a0000000-0000-4000-8000-000000000001";
const B = "a0000000-0000-4000-8000-000000000002";
const L1 = "c0000000-0000-4000-8000-000000000001";
const P1 = "d0000000-0000-4000-8000-000000000001";
const ctx: RequestContext = {
  members: new Map([[A, "Nguyễn Văn An"], [B, "Trần Thị Bình"]]),
  links: new Map([[L1, { child: A, parent: B, kind: "biological" }]]),
  partnerships: new Map([[P1, { a: A, b: B, status: "married" }]]),
  branches: new Map([["b1", "Nhánh Cả"]]),
};
const req = (kind: ChangeRequestRow["kind"], payload: Record<string, unknown>, target: string | null = null): ChangeRequestRow => ({
  id: "r", family_id: "f", requested_by: "u", kind, target_member_id: target, branch_id: null, payload, note: null,
  status: "pending", reviewed_by: null, reviewed_at: null, review_note: null, created_at: "2026-01-01T00:00:00Z",
});

describe("formatFieldValue", () => {
  it("định dạng theo loại trường", () => {
    expect(formatFieldValue("gender", "female", ctx)).toBe("Nữ");
    expect(formatFieldValue("birth_visibility", "admins", ctx)).toBe("Chỉ quản trị viên");
    expect(formatFieldValue("is_deceased", true, ctx)).toBe("Có");
    expect(formatFieldValue("branch_id", "b1", ctx)).toBe("Nhánh Cả");
    expect(formatFieldValue("branch_id", "zzz", ctx)).toBe("(nhánh không xác định)");
    expect(formatFieldValue("hometown", null, ctx)).toBe("(để trống)");
    expect(formatFieldValue("hometown", "", ctx)).toBe("(để trống)");
    expect(formatFieldValue("birth_solar_year", 1950, ctx)).toBe("1950");
    expect(formatFieldValue("bio", "x".repeat(700), ctx).length).toBe(601);
    expect(formatFieldValue("weird", { a: 1 }, ctx)).toBe('{"a":1}');
  });
});

describe("payloadChanges", () => {
  it("so sánh cũ và mới, đánh dấu trường lạ (ví dụ avatar_path)", () => {
    const r = req("update_member", { hometown: "Huế", avatar_path: "other/secret.png", gender: "male" }, A);
    const ch = payloadChanges(r, { hometown: null, gender: "female", avatar_path: null }, ctx);
    expect(ch.find((c) => c.key === "hometown")).toMatchObject({ before: "(để trống)", after: "Huế", known: true, label: "Quê quán" });
    expect(ch.find((c) => c.key === "gender")).toMatchObject({ before: "Nữ", after: "Nam" });
    expect(ch.find((c) => c.key === "avatar_path")).toMatchObject({ known: false, after: "other/secret.png" });
  });
  it("không có hồ sơ hiện tại hoặc yêu cầu tạo mới: không có cột 'trước'", () => {
    expect(payloadChanges(req("update_member", { bio: "x" }, A), null, ctx)[0].before).toBeNull();
    expect(payloadChanges(req("create_member", { full_name: "Mới" }), { full_name: "x" }, ctx)[0].before).toBeNull();
  });
});

describe("describeRequest", () => {
  it("mô tả từng loại yêu cầu", () => {
    expect(describeRequest(req("update_member", { hometown: "Huế", bio: "x" }, A), ctx)).toBe("Sửa hồ sơ “Nguyễn Văn An”: Quê quán, Tiểu sử");
    expect(describeRequest(req("create_member", { full_name: "Lê Văn C" }), ctx)).toBe("Thêm thành viên “Lê Văn C”");
    expect(describeRequest(req("delete_member", {}, B), ctx)).toBe("Xóa hồ sơ “Trần Thị Bình”");
    expect(describeRequest(req("add_parent", { child_id: A, parent_id: B, kind: "adoptive" }), ctx)).toBe("“Trần Thị Bình” là cha/mẹ nuôi của “Nguyễn Văn An”");
    expect(describeRequest(req("add_partner", { a_id: A, b_id: B, status: "divorced" }), ctx)).toBe("“Nguyễn Văn An” và “Trần Thị Bình” là vợ/chồng (đã ly hôn)");
    expect(describeRequest(req("remove_link", { link_id: L1 }), ctx)).toContain("Gỡ quan hệ cha/mẹ - con");
    expect(describeRequest(req("remove_link", { partnership_id: P1 }), ctx)).toContain("Gỡ quan hệ vợ/chồng");
    expect(describeRequest(req("remove_link", { link_id: "x" }), ctx)).toContain("không còn");
  });
  it("tên không tra được thì ghi rõ, không ném lỗi với payload lạ", () => {
    expect(describeRequest(req("delete_member", {}, "zzz"), ctx)).toContain("không xem được");
    expect(describeRequest(req("add_parent", { child_id: 5, parent_id: null }), ctx)).toContain("không xem được");
    expect(describeRequest(req("update_member", {}, A), ctx)).toContain("không có thay đổi");
  });
});

describe("referencedIds", () => {
  it("gom mã hồ sơ, quan hệ cần tra, bỏ qua giá trị không phải uuid", () => {
    const ids = referencedIds([
      req("add_parent", { child_id: A, parent_id: B }), req("remove_link", { link_id: L1 }), req("remove_link", { partnership_id: P1 }),
      req("update_member", { child_id: "<script>" }, A),
    ]);
    expect([...ids.members].sort()).toEqual([A, B]);
    expect([...ids.links]).toEqual([L1]);
    expect([...ids.partnerships]).toEqual([P1]);
  });
});
