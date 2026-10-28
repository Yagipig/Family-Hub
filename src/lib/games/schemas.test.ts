import { describe, expect, it } from "vitest";
import { gamesError } from "./errors";
import { bcBetSchema, gameSettingsSchema, lixiCreateSchema, lotoCodeSchema, lotoJoinSchema, lotteryOpenSchema, prizeListSchema, readLotteryPrizes } from "./schemas";
import { zonedLocalToUtc } from "./time";

describe("schemas: chi nhan diem ao nguyen, trong gioi han", () => {
  it("danh sach phan thuong li xi", () => {
    expect(prizeListSchema.parse("5, 10 20;30\n40")).toEqual([5, 10, 20, 30, 40]);
    expect(prizeListSchema.safeParse("").success).toBe(false);
    expect(prizeListSchema.safeParse("0").success).toBe(false);
    expect(prizeListSchema.safeParse("501").success).toBe(false);
    expect(prizeListSchema.safeParse("5.5").success).toBe(false);
    expect(prizeListSchema.safeParse("5 abc").success).toBe(false);
    expect(prizeListSchema.safeParse("-5").success).toBe(false);
    expect(prizeListSchema.safeParse("$100").success).toBe(false);
    expect(prizeListSchema.safeParse(Array(51).fill("1").join(" ")).success).toBe(false);
    expect(lixiCreateSchema.safeParse({ title: "Tet", prizes: "5 10", closeHours: "0" }).success).toBe(true);
    expect(lixiCreateSchema.safeParse({ title: "  ", prizes: "5", closeHours: "0" }).success).toBe(false);
  });
  it("cai dat", () => {
    const ok = { enabled: true, leaderboard: true, startingPoints: 100, dailyGift: 10, bcMin: 1, bcMax: 5, bcRound: 10, lossCap: 50, winCap: 200 };
    expect(gameSettingsSchema.safeParse(ok).success).toBe(true);
    expect(gameSettingsSchema.safeParse({ ...ok, bcMin: 9 }).success).toBe(false);
    expect(gameSettingsSchema.safeParse({ ...ok, bcRound: 4 }).success).toBe(false);
    expect(gameSettingsSchema.safeParse({ ...ok, startingPoints: 5000 }).success).toBe(false);
    expect(gameSettingsSchema.safeParse({ ...ok, dailyGift: -1 }).success).toBe(false);
    expect(gameSettingsSchema.safeParse({ ...ok, lossCap: 1.5 }).success).toBe(false);
  });
  it("cuoc, phong lo to, xo so", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(bcBetSchema.safeParse({ roundId: id, symbol: "3", amount: "5" }).success).toBe(true);
    expect(bcBetSchema.safeParse({ roundId: id, symbol: "7", amount: "5" }).success).toBe(false);
    expect(bcBetSchema.safeParse({ roundId: id, symbol: "3", amount: "-5" }).success).toBe(false);
    expect(bcBetSchema.safeParse({ roundId: "x", symbol: "3", amount: "5" }).success).toBe(false);
    expect(lotoJoinSchema.safeParse({ roomId: id, cards: "4" }).success).toBe(false);
    expect(lotoJoinSchema.safeParse({ roomId: id, cards: "3" }).success).toBe(true);
    expect(lotoCodeSchema.parse({ code: " ab3dEf " }).code).toBe("AB3DEF");
    expect(lotoCodeSchema.safeParse({ code: "AB0DEF" }).success).toBe(false); // 0 va O khong co trong bang ky tu
    const lot = { title: "Tet", drawAt: "2027-02-05T20:00", price: "5", free: "1", max: "3", prizes: [{ kind: "points", label: "Nhat", points: 30 }] };
    expect(lotteryOpenSchema.safeParse(lot).success).toBe(true);
    expect(lotteryOpenSchema.safeParse({ ...lot, free: "3", max: "2" }).success).toBe(false);
    expect(lotteryOpenSchema.safeParse({ ...lot, drawAt: "mai" }).success).toBe(false);
    expect(lotteryOpenSchema.safeParse({ ...lot, prizes: [] }).success).toBe(false);
    expect(lotteryOpenSchema.safeParse({ ...lot, prizes: [{ kind: "cash", label: "x" }] }).success).toBe(false);
  });
  it("doc hang giai tu form", () => {
    const fd = new FormData();
    for (const [k, l, p] of [["points", "Nhat", "30"], ["wish", "", ""], ["item", "Banh", "99"]]) {
      fd.append("prizeKind", k); fd.append("prizeLabel", l); fd.append("prizePoints", p);
    }
    expect(readLotteryPrizes(fd)).toEqual([{ kind: "points", label: "Nhat", points: "30" }, { kind: "item", label: "Banh" }]);
  });
});

describe("gamesError", () => {
  it("doi thong diep ky thuat sang tieng Viet", () => {
    expect(gamesError({ code: "P0001", message: "daily_limit_loss" })).toMatch(/ngày mai/);
    expect(gamesError({ code: "P0001", message: "insufficient_points" })).toMatch(/không đủ điểm/);
    expect(gamesError({ code: "P0001", message: "games_disabled" })).toMatch(/tắt/);
    expect(gamesError({ code: "P0002", message: "not_found" })).toMatch(/Không tìm thấy/);
    expect(gamesError({ code: "XX000", message: "relation foo does not exist" })).toBeNull();
    expect(gamesError(null)).toBeNull();
  });
  it("khong lo chi tiet noi bo", () => {
    expect(gamesError({ code: "P0001", message: "daily_limit_loss" })).not.toMatch(/daily_limit/);
  });
});

describe("zonedLocalToUtc", () => {
  it("Viet Nam UTC+7", () => {
    expect(zonedLocalToUtc("2027-02-05T20:00", "Asia/Ho_Chi_Minh")?.toISOString()).toBe("2027-02-05T13:00:00.000Z");
  });
  it("Nhat Ban UTC+9, New York (mua dong UTC-5 / mua he UTC-4)", () => {
    expect(zonedLocalToUtc("2027-02-05T20:00", "Asia/Tokyo")?.toISOString()).toBe("2027-02-05T11:00:00.000Z");
    expect(zonedLocalToUtc("2027-01-15T12:00", "America/New_York")?.toISOString()).toBe("2027-01-15T17:00:00.000Z");
    expect(zonedLocalToUtc("2027-07-15T12:00", "America/New_York")?.toISOString()).toBe("2027-07-15T16:00:00.000Z");
  });
  it("sai dinh dang, mui gio la, gio khong ton tai", () => {
    expect(zonedLocalToUtc("2027-02-05 20:00", "Asia/Tokyo")).toBeNull();
    expect(zonedLocalToUtc("2027-02-05T20:00", "Khong/Co")).toBeNull();
    expect(zonedLocalToUtc("2027-03-14T02:30", "America/New_York")).toBeNull(); // nhay gio mua he: 02:30 khong ton tai
    expect(zonedLocalToUtc("2027-02-30T10:00", "Asia/Tokyo")).toBeNull();
  });
});
