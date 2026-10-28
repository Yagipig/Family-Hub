import { describe, expect, it } from "vitest";
import { GIFT_STATUS_LABEL, cardsError, composeSchema, giftActionsFor, standaloneGiftSchema } from "./cards";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const base = {
  templateKey: "tet-hoa-mai", title: "", message: "Chúc Tết", audienceKind: "users" as const, userIds: [U1],
  branchId: "", when: "now" as const, withGift: false, giftAmount: "", giftCurrency: "VND",
};

describe("composeSchema", () => {
  it("chấp nhận thiệp hợp lệ", () => {
    const r = composeSchema.safeParse(base);
    expect(r.success).toBe(true);
  });
  it("lời chúc: rỗng, chỉ khoảng trắng, > 2000 ký tự (đếm theo ký tự Unicode) bị từ chối", () => {
    expect(composeSchema.safeParse({ ...base, message: "   " }).success).toBe(false);
    expect(composeSchema.safeParse({ ...base, message: "a".repeat(2001) }).success).toBe(false);
    expect(composeSchema.safeParse({ ...base, message: "a".repeat(2000) }).success).toBe(true);
    expect(composeSchema.safeParse({ ...base, message: "😀".repeat(2000) }).success).toBe(true); // 2000 ký tự, dù 4000 đơn vị UTF-16
    expect(composeSchema.safeParse({ ...base, message: "😀".repeat(2001) }).success).toBe(false);
  });
  it("chuẩn hóa xuống dòng", () => {
    const r = composeSchema.parse({ ...base, message: "a\r\nb  " });
    expect(r.message).toBe("a\nb");
  });
  it("mẫu lạ, người nhận rỗng/không phải uuid, thiếu nhánh, hẹn giờ thiếu ngày giờ bị từ chối", () => {
    expect(composeSchema.safeParse({ ...base, templateKey: "khong-co" }).success).toBe(false);
    expect(composeSchema.safeParse({ ...base, userIds: [] }).success).toBe(false);
    expect(composeSchema.safeParse({ ...base, userIds: ["abc"] }).success).toBe(false);
    expect(composeSchema.safeParse({ ...base, audienceKind: "branch", userIds: [] }).success).toBe(false);
    expect(composeSchema.safeParse({ ...base, audienceKind: "family", userIds: [] }).success).toBe(true);
    expect(composeSchema.safeParse({ ...base, when: "later" }).success).toBe(false);
    expect(composeSchema.safeParse({ ...base, when: "later", scheduledLocal: "2026-12-31T08:00" }).success).toBe(true);
    expect(composeSchema.safeParse({ ...base, when: "later", scheduledLocal: "31/12/2026" }).success).toBe(false);
  });
  it("lì xì đính kèm: số tiền, tiền tệ, ghi chú, giới hạn người nhận", () => {
    const g = { ...base, withGift: true };
    expect(composeSchema.safeParse({ ...g, giftAmount: "500.000" }).success).toBe(true);
    expect(composeSchema.safeParse({ ...g, giftAmount: "" }).success).toBe(true); // không ghi số tiền
    expect(composeSchema.safeParse({ ...g, giftAmount: "abc" }).success).toBe(false);
    expect(composeSchema.safeParse({ ...g, giftAmount: "0" }).success).toBe(false);
    expect(composeSchema.safeParse({ ...g, giftAmount: "10", giftCurrency: "XXX" }).success).toBe(false);
    expect(composeSchema.safeParse({ ...g, giftAmount: "10", giftNote: "4111 1111 1111 1111" }).success).toBe(false);
    expect(composeSchema.safeParse({ ...g, audienceKind: "family", userIds: [] }).success).toBe(false);
    expect(composeSchema.safeParse({ ...g, userIds: Array.from({ length: 21 }, (_, i) => `${i.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`) }).success).toBe(false);
    expect(composeSchema.safeParse({ ...g, userIds: [U1, U2] }).success).toBe(true);
  });
});

describe("standaloneGiftSchema", () => {
  it("kiểm tra người nhận, tiền tệ, số tiền", () => {
    expect(standaloneGiftSchema.safeParse({ recipientId: U1, amount: "200.000", currency: "VND" }).success).toBe(true);
    expect(standaloneGiftSchema.safeParse({ recipientId: U1, amount: "", currency: "VND" }).success).toBe(true);
    expect(standaloneGiftSchema.safeParse({ recipientId: "x", amount: "1", currency: "VND" }).success).toBe(false);
    expect(standaloneGiftSchema.safeParse({ recipientId: U1, amount: "-1", currency: "VND" }).success).toBe(false);
    expect(standaloneGiftSchema.safeParse({ recipientId: U1, amount: "1", currency: "ZZZ" }).success).toBe(false);
  });
});

describe("máy trạng thái lì xì (giao diện khớp với DB)", () => {
  it("người gửi/người nhận chỉ thấy đúng nút", () => {
    expect(giftActionsFor("pledged", "sender")).toEqual(["mark_sent", "cancel"]);
    expect(giftActionsFor("pledged", "recipient")).toEqual([]);
    expect(giftActionsFor("sender_marked_sent", "sender")).toEqual([]);
    expect(giftActionsFor("sender_marked_sent", "recipient")).toEqual(["confirm", "dispute"]);
    expect(giftActionsFor("disputed", "sender")).toEqual(["mark_sent", "cancel"]);
    expect(giftActionsFor("disputed", "recipient")).toEqual(["confirm"]);
    for (const s of ["recipient_confirmed", "cancelled"] as const) {
      expect(giftActionsFor(s, "sender")).toEqual([]);
      expect(giftActionsFor(s, "recipient")).toEqual([]);
    }
    expect(Object.keys(GIFT_STATUS_LABEL)).toHaveLength(5);
  });
});

describe("cardsError", () => {
  it("dịch lỗi và không lộ chi tiết lạ", () => {
    expect(cardsError({ message: "recipient_limit" })).toMatch(/200/);
    expect(cardsError({ message: "card_already_delivered" })).toMatch(/không sửa/);
    expect(cardsError({ code: "42501", message: "forbidden" })).toMatch(/không có quyền/);
    expect(cardsError({ code: "XX000", message: "relation \"secret_table\" does not exist" })).not.toMatch(/secret_table/);
    expect(cardsError(null)).toBe("");
  });
});
