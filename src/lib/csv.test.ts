import { describe, expect, it } from "vitest";
import { csvCell, csvLunarDate, csvSolarDate, toCsv } from "./csv";

describe("csv", () => {
  it("thoát dấu phẩy, nháy kép và xuống dòng", () => {
    expect(csvCell('Nguyễn, "Văn"')).toBe('"Nguyễn, ""Văn"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(1950)).toBe("1950");
    expect(csvCell(true)).toBe("Có");
    expect(csvCell(false)).toBe("");
  });
  it("chặn chèn công thức", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("+84901234567")).toBe("'+84901234567");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("\tcmd")).toBe("'\tcmd");
    expect(csvCell("-5")).toBe("-5");
  });
  it("có BOM UTF-8 và dòng tiêu đề", () => {
    const out = toCsv(["Họ tên", "Năm"], [["An", 1990], ["Bình, B", null]]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out.split("\r\n")).toEqual(["﻿Họ tên,Năm", "An,1990", '"Bình, B",', ""]);
  });
  it("ngày dương / âm cho CSV", () => {
    expect(csvSolarDate(1950, 5, 10)).toBe("10/05/1950");
    expect(csvSolarDate(1950, 5, null)).toBe("05/1950");
    expect(csvSolarDate(1950, null, null)).toBe("1950");
    expect(csvSolarDate(null, 5, 10)).toBe("10/05");
    expect(csvSolarDate(null, null, null)).toBe("");
    expect(csvLunarDate(null, 3, 15, false)).toBe("15/03");
    expect(csvLunarDate(1950, 3, 15, true)).toBe("15/03 nhuận/1950");
    expect(csvLunarDate(null, null, 15, false)).toBe("");
  });
});
