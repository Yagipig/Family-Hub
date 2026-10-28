import { describe, expect, it } from "vitest";
import { formatGiftAmount, formatMinor, minorDigits, parseAmountToMinor } from "./cards-money";

describe("parseAmountToMinor", () => {
  it("VND/JPY không có phần lẻ; dấu . và , là phân cách hàng nghìn", () => {
    expect(parseAmountToMinor("500000", "VND")).toBe(500000);
    expect(parseAmountToMinor("500.000", "VND")).toBe(500000);
    expect(parseAmountToMinor("500,000", "VND")).toBe(500000);
    expect(parseAmountToMinor("1.250.000", "VND")).toBe(1250000);
    expect(parseAmountToMinor("  2 000 ", "JPY")).toBe(2000);
    expect(parseAmountToMinor("1,5", "VND")).toBe(15); // VND không có phần lẻ: dấu phẩy chỉ là dấu nhóm, không hiểu là 1,5 đồng
  });
  it("USD/EUR có 2 chữ số lẻ", () => {
    expect(parseAmountToMinor("20", "USD")).toBe(2000);
    expect(parseAmountToMinor("20.5", "USD")).toBe(2050);
    expect(parseAmountToMinor("20.50", "USD")).toBe(2050);
    expect(parseAmountToMinor("1,250.50", "USD")).toBe(125050);
    expect(parseAmountToMinor("1.250,50", "EUR")).toBe(125050);
    expect(parseAmountToMinor("1,250", "USD")).toBe(125000); // 3 số sau dấu: nhóm nghìn
    expect(parseAmountToMinor("0.99", "USD")).toBe(99);
  });
  it("từ chối giá trị sai", () => {
    for (const bad of ["", "abc", "0", "0.00", "-5", "1e5", "12 34x", "...", "999999999999999999999"]) {
      expect(parseAmountToMinor(bad, "USD"), bad).toBeNull();
    }
    expect(parseAmountToMinor("10000000000000", "USD")).toBeNull(); // 10^13 USD = 10^15 đơn vị nhỏ, vượt trần 10^14
  });
  it("đơn vị nhỏ", () => {
    expect(minorDigits("VND")).toBe(0);
    expect(minorDigits("JPY")).toBe(0);
    expect(minorDigits("USD")).toBe(2);
  });
  it("định dạng hiển thị", () => {
    expect(formatMinor(500000, "VND")).toMatch(/500\.000/);
    expect(formatMinor(2050, "USD")).toMatch(/20,50/);
    expect(formatMinor(100, "XXX")).toBeTruthy();
    expect(formatGiftAmount(null, null)).toBe("Không ghi số tiền");
  });
});
