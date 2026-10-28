import { describe, expect, it } from "vitest";
import { buildCalendarHref, parseCalendarParams, parseShow, toggleShow } from "./calendar-params";

const today = { year: 2026, month: 11, day: 11 };

describe("calendar-params", () => {
  it("mặc định: tháng hiện tại, hiện âm lịch, hiện mọi loại", () => {
    const p = parseCalendarParams({}, today);
    expect(p).toMatchObject({ view: "thang", year: 2026, month: 11, day: null, lunar: true, show: { birthday: true, death: true, event: true } });
    expect(buildCalendarHref(p)).toBe("/lich?thang=2026-11");
  });
  it("tham số rác bị bỏ qua, không gây lỗi", () => {
    const p = parseCalendarParams({ thang: "9999-99", ngay: "2026-02-31", xem: "x", loc: "zzz", am: "1" }, today);
    expect(p).toMatchObject({ year: 2026, month: 11, day: null, view: "thang", lunar: true });
    expect(p.show).toEqual({ birthday: true, death: true, event: true });
  });
  it("chỉ có ?ngay: tháng của ngày đó", () => {
    expect(parseCalendarParams({ ngay: "2027-03-05" }, today)).toMatchObject({ year: 2027, month: 3, day: "2027-03-05" });
  });
  it("khứ hồi: build rồi parse cho cùng kết quả", () => {
    const p = parseCalendarParams({ thang: "2026-12", ngay: "2026-12-25", am: "0", loc: "sn,sk" }, today);
    expect(p.show).toEqual({ birthday: true, death: false, event: true });
    const href = buildCalendarHref(p);
    expect(href).toBe("/lich?thang=2026-12&ngay=2026-12-25&am=0&loc=sn,sk");
    const q = new URL(href, "http://x").searchParams;
    expect(parseCalendarParams(Object.fromEntries(q), today)).toEqual(p);
  });
  it("danh sách sắp tới không mang tháng/ngày", () => {
    const p = parseCalendarParams({ xem: "sap-toi", thang: "2026-12" }, today);
    expect(buildCalendarHref(p)).toBe("/lich?xem=sap-toi");
  });
  it("toggleShow luôn giữ ít nhất một loại", () => {
    let s = parseShow(undefined);
    s = toggleShow(s, "birthday"); s = toggleShow(s, "death");
    expect(s).toEqual({ birthday: false, death: false, event: true });
    expect(toggleShow(s, "event")).toEqual(s);
  });
  it("giá trị mảng (searchParams lặp) lấy phần tử đầu", () => {
    expect(parseCalendarParams({ thang: ["2026-05", "2026-06"] }, today).month).toBe(5);
  });
});
