import { describe, expect, it } from "vitest";
import {
  addParentSchema, addPartnerSchema, createPayload, diffMember, IMPORT_MAX_MEMBERS, parseImportText, parseListParams,
  parseMemberForm, sameOrigin,
} from "./members-schemas";
import type { MemberRow } from "./members-types";

function form(entries: Record<string, string>, groups = "basic,other,birth,death,contact,visibility") {
  const fd = new FormData();
  fd.set("groups", groups);
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}
const ALL = { birth: true, death: true, contact: true, photo: true };

describe("parseMemberForm", () => {
  it("đọc biểu mẫu đầy đủ, chuỗi rỗng thành null, số thành number", () => {
    const r = parseMemberForm(form({
      full_name: "  Nguyễn Văn An ", nickname: "", gender: "male", branch_id: "", birth_solar_year: "1950", birth_solar_month: "5",
      birth_solar_day: "10", birthday_mode: "solar", hometown: "Huế", generation_no: "3", phone: "+84 90 123 4567", email: "an@example.com",
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.full_name).toBe("Nguyễn Văn An");
    expect(r.data.nickname).toBeNull();
    expect(r.data.branch_id).toBeNull();
    expect(r.data.birth_solar_year).toBe(1950);
    expect(r.data.generation_no).toBe(3);
    expect(r.data.is_deceased).toBe(false);
  });
  it("họ tên rỗng bị từ chối với thông báo tiếng Việt", () => {
    const r = parseMemberForm(form({ full_name: "   " }));
    expect(r).toEqual({ ok: false, error: "Vui lòng nhập họ tên" });
  });
  it("nhóm không được gửi thì không xuất hiện (không ghi đè)", () => {
    const r = parseMemberForm(form({ full_name: "An", phone: "0900" }, "basic"));
    expect(r.ok && "phone" in r.data).toBe(false);
    expect(r.ok && "is_deceased" in r.data).toBe(false);
  });
  it("ô số không phải số bị báo lỗi", () => {
    const r = parseMemberForm(form({ full_name: "An", birth_solar_year: "19x0" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Năm sinh dương lịch/);
  });
  it("giá trị ngoài khoảng bị từ chối", () => {
    expect(parseMemberForm(form({ full_name: "An", birth_solar_month: "13" })).ok).toBe(false);
    expect(parseMemberForm(form({ full_name: "An", birth_lunar_day: "31", birth_lunar_month: "1" })).ok).toBe(false);
    expect(parseMemberForm(form({ full_name: "An", generation_no: "61" })).ok).toBe(false);
    expect(parseMemberForm(form({ full_name: "An", birth_solar_year: "999" })).ok).toBe(false);
  });
  it("ngày dương không có thật bị từ chối (31/2, 29/2 năm không nhuận)", () => {
    expect(parseMemberForm(form({ full_name: "An", birth_solar_month: "2", birth_solar_day: "31" })).ok).toBe(false);
    expect(parseMemberForm(form({ full_name: "An", birth_solar_year: "2023", birth_solar_month: "2", birth_solar_day: "29" })).ok).toBe(false);
    expect(parseMemberForm(form({ full_name: "An", birth_solar_year: "2024", birth_solar_month: "2", birth_solar_day: "29", birthday_mode: "solar" })).ok).toBe(true);
  });
  it("ngày cần tháng", () => {
    expect(parseMemberForm(form({ full_name: "An", birth_solar_day: "5" })).ok).toBe(false);
    expect(parseMemberForm(form({ full_name: "An", birth_lunar_day: "5" })).ok).toBe(false);
  });
  it("chỉ có năm sinh vẫn hợp lệ (kiểu sinh nhật mặc định dương)", () => {
    expect(parseMemberForm(form({ full_name: "An", birth_solar_year: "1953", birthday_mode: "solar" })).ok).toBe(true);
  });
  it("kiểu sinh nhật khớp ngày đã nhập", () => {
    const onlyLunar = parseMemberForm(form({ full_name: "An", birthday_mode: "solar", birth_lunar_month: "3", birth_lunar_day: "15" }));
    expect(onlyLunar.ok).toBe(false);
    const lunarOk = parseMemberForm(form({ full_name: "An", birthday_mode: "lunar", birth_lunar_month: "3", birth_lunar_day: "15" }));
    expect(lunarOk.ok).toBe(true);
    const bothMissing = parseMemberForm(form({ full_name: "An", birthday_mode: "both", birth_solar_month: "3", birth_solar_day: "15" }));
    expect(bothMissing.ok).toBe(false);
  });
  it("chưa đánh dấu 'đã mất' thì xóa toàn bộ ngày mất", () => {
    const r = parseMemberForm(form({ full_name: "An", death_solar_year: "2001", death_lunar_month: "2", death_lunar_leap: "on" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.is_deceased).toBe(false);
      expect(r.data.death_solar_year).toBeNull();
      expect(r.data.death_lunar_month).toBeNull();
      expect(r.data.death_lunar_leap).toBe(false);
    }
  });
  it("đã mất: giữ ngày mất; năm mất trước năm sinh bị từ chối", () => {
    const ok = parseMemberForm(form({ full_name: "An", is_deceased: "on", death_solar_year: "2001", birth_solar_year: "1930", birthday_mode: "solar" }));
    expect(ok.ok && ok.data.death_solar_year).toBe(2001);
    const bad = parseMemberForm(form({ full_name: "An", is_deceased: "on", death_solar_year: "1900", birth_solar_year: "1930", birthday_mode: "solar" }));
    expect(bad.ok).toBe(false);
  });
  it("điện thoại / email không hợp lệ bị từ chối; để trống thì được", () => {
    expect(parseMemberForm(form({ full_name: "An", phone: "abc<script>" })).ok).toBe(false);
    expect(parseMemberForm(form({ full_name: "An", email: "khong-phai-email" })).ok).toBe(false);
    expect(parseMemberForm(form({ full_name: "An", phone: "", email: "" })).ok).toBe(true);
  });
  it("giá trị enum lạ bị từ chối; mã nhánh không phải uuid bị từ chối", () => {
    expect(parseMemberForm(form({ full_name: "An", gender: "robot" })).ok).toBe(false);
    expect(parseMemberForm(form({ full_name: "An", branch_id: "abc" })).ok).toBe(false);
    expect(parseMemberForm(form({ full_name: "An", birth_visibility: "public" })).ok).toBe(false);
    expect(parseMemberForm(form({ full_name: "An", birthday_mode: "x" })).ok).toBe(false);
  });
  it("giới hạn độ dài tiểu sử", () => {
    expect(parseMemberForm(form({ full_name: "An", bio: "x".repeat(5001) })).ok).toBe(false);
    expect(parseMemberForm(form({ full_name: "An", bio: "x".repeat(5000) })).ok).toBe(true);
  });
  it("thiếu 'groups' bị từ chối; khóa lạ (avatar_path) không bao giờ được đọc", () => {
    const fd = new FormData(); fd.set("full_name", "An");
    expect(parseMemberForm(fd).ok).toBe(false);
    const r = parseMemberForm(form({ full_name: "An", avatar_path: "../../etc/passwd", family_id: "x" }));
    expect(r.ok && Object.keys(r.data).includes("avatar_path")).toBe(false);
    expect(r.ok && Object.keys(r.data).includes("family_id")).toBe(false);
  });
});

describe("diffMember", () => {
  const original = {
    full_name: "An", nickname: null, gender: "male", branch_id: "b1", birth_solar_year: 1950, birth_solar_month: 5, birth_solar_day: 10,
    birth_lunar_leap: false, death_lunar_leap: false, birthday_mode: "solar", is_deceased: false, phone: "0900", hometown: null, bio: "x", birth_visibility: "family",
  } as unknown as MemberRow;
  const next = (over: Record<string, string>) => {
    const r = parseMemberForm(form({
      full_name: "An", nickname: "", gender: "male", branch_id: "b0000000-0000-4000-8000-000000000001", birth_solar_year: "1950",
      birth_solar_month: "5", birth_solar_day: "10", birthday_mode: "solar", phone: "0900", hometown: "", bio: "x", birth_visibility: "family", ...over,
    }));
    if (!r.ok) throw new Error(r.error);
    return r.data;
  };
  it("chỉ trả về trường thật sự đổi (null và chuỗi rỗng coi như nhau)", () => {
    const d = diffMember({ ...original, branch_id: "b0000000-0000-4000-8000-000000000001" } as MemberRow, next({ hometown: "Huế", bio: "y" }), ALL);
    expect(d).toEqual({ hometown: "Huế", bio: "y" });
  });
  it("không có thay đổi => rỗng", () => {
    expect(diffMember({ ...original, branch_id: "b0000000-0000-4000-8000-000000000001", birthday_mode: "solar" } as MemberRow, next({}), ALL)).toEqual({});
  });
  it("xóa giá trị đang có => null", () => {
    const d = diffMember({ ...original, branch_id: "b0000000-0000-4000-8000-000000000001", birthday_mode: "solar" } as MemberRow, next({ phone: "" }), ALL);
    expect(d).toEqual({ phone: null });
  });
  it("nhóm bị che không bao giờ được ghi đè", () => {
    const masked = { ...ALL, birth: false, contact: false };
    const d = diffMember(
      { ...original, branch_id: "b0000000-0000-4000-8000-000000000001", birth_solar_month: null, birth_solar_day: null, phone: null } as unknown as MemberRow,
      next({ phone: "0911", birth_solar_month: "7" }), masked,
    );
    expect(d).toEqual({});
  });
});

describe("createPayload", () => {
  it("bỏ trường rỗng/null", () => {
    const r = parseMemberForm(form({ full_name: "An", nickname: "", gender: "female", birth_solar_year: "1990", birthday_mode: "solar" }));
    if (!r.ok) throw new Error(r.error);
    const p = createPayload(r.data);
    expect(p.full_name).toBe("An");
    expect(p.gender).toBe("female");
    expect("nickname" in p).toBe(false);
    expect(p.is_deceased).toBe(false);
  });
});

describe("quan hệ", () => {
  const A = "a0000000-0000-4000-8000-000000000001";
  const B = "a0000000-0000-4000-8000-000000000002";
  it("addParent: không tự làm cha mẹ chính mình, loại không hợp lệ bị từ chối", () => {
    expect(addParentSchema.safeParse({ childId: A, parentId: B, kind: "biological" }).success).toBe(true);
    expect(addParentSchema.safeParse({ childId: A, parentId: A, kind: "biological" }).success).toBe(false);
    expect(addParentSchema.safeParse({ childId: A, parentId: B, kind: "x" }).success).toBe(false);
    expect(addParentSchema.safeParse({ childId: A, parentId: "", kind: "step" }).success).toBe(false);
  });
  it("addPartner: năm hợp lệ, kết thúc không trước bắt đầu", () => {
    const base = { aId: A, bId: B, status: "married" };
    expect(addPartnerSchema.safeParse({ ...base, startYear: "1990", endYear: "" }).success).toBe(true);
    expect(addPartnerSchema.safeParse({ ...base, startYear: "1990", endYear: "1980" }).success).toBe(false);
    expect(addPartnerSchema.safeParse({ ...base, startYear: "abc", endYear: "" }).success).toBe(false);
    expect(addPartnerSchema.safeParse({ ...base, bId: A, startYear: "", endYear: "" }).success).toBe(false);
    expect(addPartnerSchema.safeParse({ ...base, status: "engaged", startYear: "", endYear: "" }).success).toBe(false);
  });
});

describe("parseListParams", () => {
  it("giá trị lạ về mặc định, trang tối thiểu 1", () => {
    expect(parseListParams({ q: " An ", branch: "x", gender: "z", alive: "?", page: "-3" })).toEqual({ q: "An", branch: "", gender: "", alive: "", page: 1 });
    expect(parseListParams({ branch: "none", gender: "male", alive: "deceased", page: "4" })).toEqual({ q: "", branch: "none", gender: "male", alive: "deceased", page: 4 });
    expect(parseListParams({ q: ["a", "b"] }).q).toBe("");
    expect(parseListParams({ q: "x".repeat(100) }).q).toHaveLength(40);
  });
});

describe("parseImportText", () => {
  const good = {
    version: 1,
    members: [{ id: "1", full_name: "An", gender: "male", branch: "Nhánh A", birth_solar_year: 1950, avatar_path: "a/b.png", family_id: "x" }, { id: "2", full_name: "Bình" }],
    parents: [{ child: "2", parent: "1", kind: "biological" }],
    partners: [{ a: "1", b: "2", status: "married", start_year: null, end_year: null }],
  };
  it("nhận tệp hợp lệ và làm sạch: bỏ avatar_path và trường lạ", () => {
    const r = parseImportText(JSON.stringify(good));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.members[0]).not.toHaveProperty("avatar_path");
    expect(r.data.members[0]).not.toHaveProperty("family_id");
    expect(r.data.members[0].full_name).toBe("An");
  });
  it("id số được đổi sang chuỗi", () => {
    const r = parseImportText(JSON.stringify({ version: 1, members: [{ id: 7, full_name: "X" }], parents: [{ child: 7, parent: 7 }] }));
    expect(r.ok && r.data.members[0].id).toBe("7");
  });
  it("JSON hỏng, thiếu version, thiếu members, sai kiểu", () => {
    expect(parseImportText("{khong phai json")).toEqual({ ok: false, error: "Tệp không phải JSON hợp lệ." });
    expect(parseImportText(JSON.stringify({ members: [] })).ok).toBe(false);
    expect(parseImportText(JSON.stringify({ version: 1 })).ok).toBe(false);
    expect(parseImportText(JSON.stringify({ version: 1, members: "x" })).ok).toBe(false);
    expect(parseImportText("null").ok).toBe(false);
    expect(parseImportText("[]").ok).toBe(false);
  });
  it("lỗi chỉ rõ thành viên thứ mấy, bằng tiếng Việt", () => {
    const r = parseImportText(JSON.stringify({ version: 1, members: [{ id: "1", full_name: "A" }, { id: "2", full_name: "" }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Thành viên thứ 2/);
  });
  it("trùng mã thành viên, giá trị ngoài khoảng, enum lạ", () => {
    expect(parseImportText(JSON.stringify({ version: 1, members: [{ id: "1", full_name: "A" }, { id: "1", full_name: "B" }] })).ok).toBe(false);
    expect(parseImportText(JSON.stringify({ version: 1, members: [{ id: "1", full_name: "A", birth_solar_month: 13 }] })).ok).toBe(false);
    expect(parseImportText(JSON.stringify({ version: 1, members: [{ id: "1", full_name: "A", gender: "x" }] })).ok).toBe(false);
    expect(parseImportText(JSON.stringify({ version: 1, members: [], parents: [{ child: "1", parent: "2", kind: "foster" }] })).ok).toBe(false);
  });
  it(`giới hạn ${IMPORT_MAX_MEMBERS} thành viên`, () => {
    const many = Array.from({ length: IMPORT_MAX_MEMBERS + 1 }, (_, i) => ({ id: String(i), full_name: "X" }));
    expect(parseImportText(JSON.stringify({ version: 1, members: many })).ok).toBe(false);
    expect(parseImportText(JSON.stringify({ version: 1, members: many.slice(0, IMPORT_MAX_MEMBERS) })).ok).toBe(true);
  });
});

describe("sameOrigin", () => {
  it("cùng host thì đúng, khác host thì sai, không có Origin thì cho qua", () => {
    expect(sameOrigin("https://app.example.com", "app.example.com")).toBe(true);
    expect(sameOrigin("https://evil.example.com", "app.example.com")).toBe(false);
    expect(sameOrigin(null, "app.example.com")).toBe(true);
    expect(sameOrigin("not a url", "app.example.com")).toBe(false);
    expect(sameOrigin("https://app.example.com", null)).toBe(false);
  });
});
