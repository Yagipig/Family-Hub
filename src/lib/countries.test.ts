import { describe, expect, it } from "vitest";
import { COUNTRIES, allZones, countryForZone, countryName, defaultZoneFor, findCountry } from "./countries";
import { isValidTimeZone } from "./tz";

describe("bảng quốc gia → múi giờ", () => {
  it("có ít nhất 40 quốc gia, mã ISO hợp lệ và không trùng", () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(40);
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(/^[A-Z]{2}$/);
  });
  it("mọi múi giờ là IANA hợp lệ, mỗi nước có ít nhất một", () => {
    for (const c of COUNTRIES) {
      expect(c.zones.length, c.code).toBeGreaterThan(0);
      expect(new Set(c.zones).size, c.code).toBe(c.zones.length);
      for (const z of c.zones) expect(isValidTimeZone(z), `${c.code} ${z}`).toBe(true);
      expect(c.name.length).toBeGreaterThan(0);
    }
  });
  it("các nước yêu cầu có đủ và các nước nhiều múi giờ có nhiều lựa chọn", () => {
    for (const code of ["VN","JP","KR","TW","SG","TH","MY","CN","HK","AU","NZ","US","CA","GB","FR","DE","CH","NO","SE","RU"]) {
      expect(findCountry(code), code).toBeDefined();
    }
    expect(findCountry("US")!.zones.length).toBeGreaterThan(4);
    expect(findCountry("CA")!.zones.length).toBeGreaterThan(3);
    expect(findCountry("RU")!.zones.length).toBeGreaterThan(5);
    expect(findCountry("AU")!.zones.length).toBeGreaterThan(4);
  });
  it("gợi ý mặc định và tra ngược", () => {
    expect(defaultZoneFor("VN")).toBe("Asia/Ho_Chi_Minh");
    expect(defaultZoneFor("jp")).toBe("Asia/Tokyo");
    expect(defaultZoneFor("XX")).toBeNull();
    expect(defaultZoneFor(null)).toBeNull();
    expect(countryName("JP")).toBe("Nhật Bản");
    expect(countryName(null)).toBe("Khác");
    expect(countryForZone("Asia/Tokyo")?.code).toBe("JP");
    expect(countryForZone("Mars/X")).toBeUndefined();
  });
  it("allZones chứa mọi múi giờ trong bảng quốc gia", () => {
    const all = new Set(allZones());
    expect(all.size).toBeGreaterThan(100);
    for (const c of COUNTRIES) for (const z of c.zones) expect(all.has(z), z).toBe(true);
  });
});
