import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROVINCES63 } from "./provinces63";
import { isValidLotoCard } from "./loto";

describe("Ban do 63 tinh cu", () => {
  it("du 63 tinh, ma VN63-001..063 khong trung", () => {
    expect(PROVINCES63).toHaveLength(63);
    const codes = PROVINCES63.map((p) => p.code);
    expect(new Set(codes).size).toBe(63);
    expect(codes[0]).toBe("VN63-001");
    expect(codes[62]).toBe("VN63-063");
    for (const p of PROVINCES63) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.path.length).toBeGreaterThan(50);
      expect(["bac", "trung", "nam"]).toContain(p.region);
    }
  });
  it("co Ha Noi, Hue, Da Nang, Ho Chi Minh, Can Tho, Ca Mau", () => {
    const names = PROVINCES63.map((p) => p.name);
    for (const n of ["Hà Nội", "Thừa Thiên Huế", "Đà Nẵng", "Hồ Chí Minh", "Cần Thơ", "Cà Mau"]) {
      expect(names).toContain(n);
    }
  });
});

describe("63 bang co dinh trong migration", () => {
  const sql = readFileSync("supabase/migrations/20261104000005_loto_traditional.sql", "utf8");
  const rows = [...sql.matchAll(/\('(VN63-\d{3})', '([^']+)', '(bac|trung|nam)', array\[([0-9,]+)\]::smallint\[\]\)/g)];

  it("seed du 63 bang, dung thu tu ma voi ban do", () => {
    expect(rows).toHaveLength(63);
    rows.forEach((m, i) => {
      expect(m[1]).toBe(PROVINCES63[i].code);
      expect(m[2]).toBe(PROVINCES63[i].name);
      expect(m[3]).toBe(PROVINCES63[i].region);
    });
  });

  it("moi bang hop le theo luat lo to 90 so va khong trung nhau", () => {
    const seen = new Set<string>();
    for (const m of rows) {
      const grid = m[4].split(",").map(Number);
      expect(isValidLotoCard(grid)).toBe(true);
      const key = grid.join(",");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
