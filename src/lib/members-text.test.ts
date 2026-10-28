import { describe, expect, it } from "vitest";
import {
  accentInsensitivePattern, ageText, branchColor, foldVietnamese, formatLunar, formatSolar, initials, isValidSolarDate, lifeSpan,
} from "./members-text";

describe("foldVietnamese", () => {
  it("bỏ dấu, đ -> d, hạ chữ thường", () => {
    expect(foldVietnamese("Nguyễn Đức Thắng")).toBe("nguyen duc thang");
    expect(foldVietnamese("  ĐẶNG   Văn ")).toBe("dang van");
  });
});

describe("accentInsensitivePattern", () => {
  const re = (q: string) => new RegExp(accentInsensitivePattern(q), "i");
  it("gõ không dấu vẫn khớp có dấu", () => {
    expect(re("nguyen").test("Nguyễn Văn An")).toBe(true);
    expect(re("duc").test("Trần Đức")).toBe(true);
    expect(re("van an").test("Nguyễn Văn An")).toBe(true);
  });
  it("gõ có dấu thì chỉ khớp đúng dấu", () => {
    expect(re("Nguyễn").test("Nguyễn Văn")).toBe(true);
    expect(re("Nguyễn").test("Nguyen Van")).toBe(false);
    expect(re("Nguyễn").test("Nguyên Van")).toBe(false);
  });
  it("loại ký tự đặc biệt của regex, không ném lỗi, không chứa dấu gạch chéo ngược", () => {
    const p = accentInsensitivePattern("a.*(b)|c\\d[x]");
    expect(p).not.toMatch(/\\/);
    expect(() => new RegExp(p)).not.toThrow();
    expect(p).not.toContain("|");
    expect(p).not.toContain("*");
  });
  it("chuỗi chỉ toàn ký tự đặc biệt cho ra rỗng; cắt độ dài", () => {
    expect(accentInsensitivePattern("%%%")).toBe("");
    expect(accentInsensitivePattern("a".repeat(500)).length).toBeLessThan(40 * 40);
  });
  it("giữ nguyên chữ số và dấu gạch ngang", () => {
    expect(re("a-1").test("Bé A-1")).toBe(true);
  });
});

describe("định dạng", () => {
  it("initials theo họ + tên", () => {
    expect(initials("Nguyễn Văn An")).toBe("NA");
    expect(initials("An")).toBe("A");
    expect(initials("  ")).toBe("?");
    expect(initials("đặng thu")).toBe("ĐT");
  });
  it("ngày dương đủ / thiếu", () => {
    expect(formatSolar(1950, 5, 10)).toBe("10/05/1950");
    expect(formatSolar(1950, 5, null)).toBe("tháng 5/1950");
    expect(formatSolar(1950, null, null)).toBe("năm 1950");
    expect(formatSolar(null, 5, 10)).toBe("10/05");
    expect(formatSolar(null, null, null)).toBeNull();
  });
  it("ngày âm có tháng nhuận", () => {
    expect(formatLunar(1950, 3, 15, false)).toBe("ngày 15 tháng 3 năm 1950");
    expect(formatLunar(null, 3, 15, true)).toBe("ngày 15 tháng 3 (nhuận)");
    expect(formatLunar(null, null, 15, false)).toBeNull();
  });
  it("lifeSpan và ageText", () => {
    expect(lifeSpan(1930, 2001, true)).toBe("1930 – 2001");
    expect(lifeSpan(1930, null, true)).toBe("1930 – ?");
    expect(lifeSpan(1990, null, false)).toBe("sinh 1990");
    expect(lifeSpan(null, null, false)).toBe("");
    expect(ageText(1990, null, false, 2026)).toBe("36 tuổi");
    expect(ageText(1930, 2001, true, 2026)).toBe("thọ 71 tuổi");
    expect(ageText(1930, null, true, 2026)).toBeNull();
  });
  it("kiểm tra ngày dương có thật", () => {
    expect(isValidSolarDate(2023, 2, 29)).toBe(false);
    expect(isValidSolarDate(2024, 2, 29)).toBe(true);
    expect(isValidSolarDate(null, 2, 29)).toBe(true);
    expect(isValidSolarDate(2024, 4, 31)).toBe(false);
    expect(isValidSolarDate(2024, 13, 1)).toBe(false);
    expect(isValidSolarDate(2024, null, 5)).toBe(false);
  });
  it("màu nhánh ổn định", () => {
    expect(branchColor("abc")).toBe(branchColor("abc"));
    expect(branchColor("abc")).not.toBe(branchColor("abd"));
    expect(branchColor(null)).toMatch(/^hsl/);
  });
});
