import { describe, expect, it } from "vitest";
import { COIN_UNITS, coinLabel, formatCoinAmount, isCoinUnitKey, resolveCoin } from "./coins";

describe("resolveCoin", () => {
  it("mặc định là Điểm khi chưa có cài đặt", () => {
    expect(resolveCoin(null).key).toBe("diem");
    expect(resolveCoin(undefined).name).toBe("Điểm");
    expect(resolveCoin({}).name).toBe("Điểm");
  });

  it("đọc đúng loại xu trong danh mục", () => {
    const c = resolveCoin({ coin_unit: "heo-vang" });
    expect(c.name).toBe("Heo Vàng");
    expect(c.icon).toBe("🐷");
  });

  it("key lạ thì quay về Điểm", () => {
    expect(resolveCoin({ coin_unit: "khong-co" }).key).toBe("diem");
  });

  it("xu tự đặt dùng tên + biểu tượng của quản trị", () => {
    const c = resolveCoin({ coin_unit: "custom", coin_custom_name: "  Bắp  ", coin_custom_icon: "🌰" });
    expect(c.name).toBe("Bắp");
    expect(c.icon).toBe("🌰");
  });

  it("xu tự đặt thiếu tên/biểu tượng vẫn có giá trị dùng được", () => {
    const c = resolveCoin({ coin_unit: "custom", coin_custom_name: "", coin_custom_icon: "🚀" });
    expect(c.name).toBe("Xu");
    expect(c.icon).toBe("🪙");
  });
});

describe("formatCoinAmount + coinLabel", () => {
  it("giữ nguyên số, chỉ thay tên đơn vị", () => {
    const heo = COIN_UNITS.find((u) => u.key === "heo-vang")!;
    expect(formatCoinAmount(1250, heo)).toBe("1.250 Heo Vàng");
    expect(formatCoinAmount(50, resolveCoin(null))).toBe("50 Điểm");
  });

  it("nhãn có biểu tượng, Điểm mặc định không biểu tượng", () => {
    expect(coinLabel(resolveCoin({ coin_unit: "la" }))).toBe("🍃 Lá");
    expect(coinLabel(resolveCoin(null))).toBe("Điểm");
  });
});

describe("isCoinUnitKey", () => {
  it("chấp nhận key trong danh mục và custom", () => {
    expect(isCoinUnitKey("cu")).toBe(true);
    expect(isCoinUnitKey("custom")).toBe(true);
    expect(isCoinUnitKey("bitcoin")).toBe(false);
  });
});
