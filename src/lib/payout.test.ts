import { describe, expect, it } from "vitest";
import { findCardNumber, last4Of, luhnValid, maskedNumber, parseSecret, payoutInputSchema, sensitiveReason, toSecret } from "./payout";

const base = { kind: "bank", label: "Vietcombank của tôi", holder: "NGUYEN VAN A", number: "0123456789", note: "" };

describe("Luhn và nhận diện số thẻ", () => {
  it("Luhn đúng/sai với số thẻ thử nghiệm công khai", () => {
    expect(luhnValid("4111111111111111")).toBe(true); // Visa test
    expect(luhnValid("5555555555554444")).toBe(true); // Mastercard test
    expect(luhnValid("378282246310005")).toBe(true); // Amex test (15)
    expect(luhnValid("4111111111111112")).toBe(false);
    expect(luhnValid("")).toBe(false);
    expect(luhnValid("12a4")).toBe(false);
  });
  it("chặn dãy 13–19 chữ số hợp lệ Luhn, kể cả có dấu cách/gạch ngang", () => {
    expect(findCardNumber("4111111111111111")).toBe("4111111111111111");
    expect(findCardNumber("4111 1111 1111 1111")).toBe("4111111111111111");
    expect(findCardNumber("4111-1111-1111-1111")).toBe("4111111111111111");
    expect(findCardNumber("thẻ của tôi 5555 5555 5555 4444 nhé")).toBe("5555555555554444");
    expect(findCardNumber("378282246310005")).toBe("378282246310005");
  });
  it("không chặn nhầm: số điện thoại, tài khoản ngắn, dãy 13+ chữ số không hợp lệ Luhn, quá dài", () => {
    expect(findCardNumber("0912345678")).toBeNull();
    expect(findCardNumber("0123456789")).toBeNull();
    expect(findCardNumber("4111111111111112")).toBeNull();
    expect(findCardNumber("411111111111")).toBeNull(); // 12 chữ số
    expect(findCardNumber("41111111111111111111")).toBeNull(); // 20 chữ số
    expect(findCardNumber("0912 345 678 / 0987 654 321")).toBeNull();
    expect(findCardNumber("abc")).toBeNull();
  });
  it("lý do từ chối dùng tiếng Việt và giải thích", () => {
    expect(sensitiveReason("4111 1111 1111 1111")).toMatch(/SỐ THẺ/);
    expect(sensitiveReason("mật khẩu: abc")).toMatch(/mật khẩu/);
    expect(sensitiveReason("OTP 123456")).toMatch(/OTP/);
    expect(sensitiveReason("mã PIN của tôi")).toMatch(/PIN/);
    expect(sensitiveReason("password123")).not.toBeNull();
    expect(sensitiveReason("cvv 123")).not.toBeNull();
    expect(sensitiveReason("Techcombank chi nhánh Hà Nội")).toBeNull();
    expect(sensitiveReason("Pinterest")).toBeNull(); // "pin" chỉ chặn khi đứng riêng
  });
});

describe("payoutInputSchema", () => {
  it("chấp nhận thông tin hợp lệ và cắt khoảng trắng", () => {
    const r = payoutInputSchema.safeParse({ ...base, label: "  Ví MoMo  ", kind: "ewallet", number: " 0912345678 " });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.label).toBe("Ví MoMo"); expect(r.data.number).toBe("0912345678"); expect(r.data.note).toBe(""); }
  });
  it("từ chối số thẻ ở bất kỳ trường nào, kèm giải thích", () => {
    for (const field of ["number", "label", "holder", "note"] as const) {
      const r = payoutInputSchema.safeParse({ ...base, [field]: "4111 1111 1111 1111" });
      expect(r.success, field).toBe(false);
      if (!r.success) expect(r.error.issues.some((i) => i.path[0] === field && /SỐ THẺ/.test(i.message))).toBe(true);
    }
  });
  it("từ chối nhắc mật khẩu/OTP/PIN", () => {
    expect(payoutInputSchema.safeParse({ ...base, note: "mật khẩu ngân hàng là 1234" }).success).toBe(false);
    expect(payoutInputSchema.safeParse({ ...base, label: "OTP" }).success).toBe(false);
  });
  it("từ chối trường rỗng, quá ngắn/dài, ký tự lạ, loại sai", () => {
    expect(payoutInputSchema.safeParse({ ...base, label: "" }).success).toBe(false);
    expect(payoutInputSchema.safeParse({ ...base, holder: " " }).success).toBe(false);
    expect(payoutInputSchema.safeParse({ ...base, number: "123" }).success).toBe(false);
    expect(payoutInputSchema.safeParse({ ...base, number: "12 34 5" }).success).toBe(false); // < 6 chữ số
    expect(payoutInputSchema.safeParse({ ...base, number: "1".repeat(65) }).success).toBe(false);
    expect(payoutInputSchema.safeParse({ ...base, number: "1234567890<script>" }).success).toBe(false);
    expect(payoutInputSchema.safeParse({ ...base, label: "x".repeat(61) }).success).toBe(false);
    expect(payoutInputSchema.safeParse({ ...base, note: "x".repeat(201) }).success).toBe(false);
    expect(payoutInputSchema.safeParse({ ...base, kind: "card" }).success).toBe(false);
  });
  it("cho phép ID ví dạng email/số điện thoại có dấu", () => {
    expect(payoutInputSchema.safeParse({ ...base, kind: "ewallet", number: "nguyen.van.a@example.com" }).success).toBe(true);
    expect(payoutInputSchema.safeParse({ ...base, kind: "ewallet", number: "+84 912 345 678" }).success).toBe(true);
  });
});

describe("che số và gói bí mật", () => {
  it("last4Of chỉ lấy 4 ký tự cuối khi số đủ dài", () => {
    expect(last4Of("0123456789")).toBe("6789");
    expect(last4Of("0123 4567 89")).toBe("6789");
    expect(last4Of("12345")).toBeNull();
    expect(last4Of("1234567")).toBeNull();
    expect(last4Of("12345678")).toBe("5678");
  });
  it("maskedNumber", () => {
    expect(maskedNumber("1234")).toBe("••••1234");
    expect(maskedNumber(null)).toBe("••••");
  });
  it("toSecret / parseSecret khép kín và từ chối dữ liệu sai", () => {
    const parsed = payoutInputSchema.parse({ ...base, note: "Chi nhánh Hà Nội" });
    const secret = toSecret(parsed);
    expect(parseSecret(JSON.stringify(secret))).toEqual(secret);
    expect(() => parseSecret("{}")).toThrow();
    expect(() => parseSecret('{"v":2,"holder":"a","number":"b"}')).toThrow();
    expect(() => parseSecret("khong phai json")).toThrow();
  });
});

describe("giảm chặn nhầm số tài khoản", () => {
  it("số tài khoản 13 chữ số hợp Luhn nhưng không có đầu số thẻ thì được phép", async () => {
    const { findCardNumber, luhnValid } = await import("./payout");
    // tạo số 13 chữ số bắt đầu bằng 00 và hợp Luhn
    let acct = "";
    for (let i = 0; i < 100; i++) { const c = "00123456789" + String(i).padStart(2, "0"); if (luhnValid(c)) { acct = c; break; } }
    expect(acct).not.toBe("");
    expect(findCardNumber(acct)).toBeNull();
  });
  it("số thẻ Visa/Mastercard/Napas vẫn bị chặn", async () => {
    const { findCardNumber } = await import("./payout");
    expect(findCardNumber("4111 1111 1111 1111")).not.toBeNull();
    expect(findCardNumber("5555-5555-5555-4444")).not.toBeNull();
    expect(findCardNumber("9704 0000 0000 0018")).not.toBeNull();
  });
});
