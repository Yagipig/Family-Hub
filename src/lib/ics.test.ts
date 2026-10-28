import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine, formatDateValue, formatUtc, icsFileName } from "./ics";

const unfold = (s: string) => s.replace(/\r\n[ \t]/g, "");
const NOW = new Date("2026-10-28T10:00:00Z");

/** Bộ đọc iCalendar tối giản để kiểm tra cấu trúc. */
function parse(ics: string) {
  const lines = unfold(ics).split("\r\n").filter((l) => l.length > 0);
  const events: Record<string, string>[] = [];
  let cur: Record<string, string> | null = null;
  const header: string[] = [];
  for (const l of lines) {
    if (l === "BEGIN:VEVENT") cur = {};
    else if (l === "END:VEVENT") { events.push(cur!); cur = null; }
    else if (cur) { const i = l.indexOf(":"); cur[l.slice(0, i)] = l.slice(i + 1); }
    else header.push(l);
  }
  return { header, events };
}

describe("iCalendar", () => {
  it("thoát ký tự theo RFC 5545", () => {
    expect(escapeText("a,b;c\\d")).toBe("a\\,b\;c\\\\d");
    expect(escapeText("dòng 1\r\ndòng 2\ndòng 3\rdòng 4")).toBe("dòng 1\\ndòng 2\\ndòng 3\\ndòng 4");
    expect(escapeText("a\u0000b\u0007c")).toBe("abc");
  });
  it("nội dung độc hại không tạo thêm thuộc tính hay sự kiện giả", () => {
    const ics = buildIcs({
      calName: "Lịch", now: NOW,
      events: [{ uid: "x", summary: "Tiệc\r\nBEGIN:VEVENT\r\nSUMMARY:Giả", description: "a\nATTENDEE:mailto:x@y", start: new Date("2026-11-11T16:00:00Z") }],
    });
    const { events } = parse(ics);
    expect(events).toHaveLength(1);
    expect(Object.keys(events[0]).sort()).toEqual(["DESCRIPTION", "DTSTAMP", "DTSTART", "STATUS", "SUMMARY", "UID"]);
    expect(events[0].SUMMARY).toBe("Tiệc\\nBEGIN:VEVENT\\nSUMMARY:Giả");
    expect(unfold(ics).split("\r\n").filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
  });
  it("gấp dòng ở 75 octet (UTF-8) và gỡ gấp ra đúng nguyên văn", () => {
    const long = "Họp mặt gia đình dòng họ Nguyễn nhân dịp giỗ tổ, mời toàn thể con cháu ở xa về dự đông đủ — ".repeat(5);
    const folded = foldLine(`DESCRIPTION:${escapeText(long)}`);
    const enc = new TextEncoder();
    for (const l of folded.split("\r\n")) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
    expect(unfold(folded)).toBe(`DESCRIPTION:${escapeText(long)}`);
    expect(folded.split("\r\n").slice(1).every((l) => l.startsWith(" "))).toBe(true);
    // ký tự 4 octet (emoji) không bị cắt đôi
    const emoji = foldLine("SUMMARY:" + "😀".repeat(40));
    expect(unfold(emoji)).toBe("SUMMARY:" + "😀".repeat(40));
    expect(foldLine("SUMMARY:ngắn")).toBe("SUMMARY:ngắn");
  });
  it("sự kiện có giờ: UTC; có DTEND khi có giờ kết thúc", () => {
    const { events, header } = parse(buildIcs({
      calName: "Lịch gia đình, họ Nguyễn", now: NOW,
      events: [{ uid: "ev1@fh", summary: "Họp mặt", location: "Nhà thờ họ, Hà Nội", start: new Date("2026-11-11T16:00:00Z"), end: new Date("2026-11-11T18:30:00Z"), categories: ["Họp mặt"] }],
    }));
    expect(header).toContain("VERSION:2.0");
    expect(header).toContain("X-WR-CALNAME:Lịch gia đình\\, họ Nguyễn");
    expect(header.find((h) => h.startsWith("PRODID"))).toBeTruthy();
    expect(events[0]).toMatchObject({
      UID: "ev1@fh", DTSTAMP: "20261028T100000Z", DTSTART: "20261111T160000Z", DTEND: "20261111T183000Z",
      SUMMARY: "Họp mặt", LOCATION: "Nhà thờ họ\\, Hà Nội", CATEGORIES: "Họp mặt", STATUS: "CONFIRMED",
    });
  });
  it("cả ngày: DTSTART;VALUE=DATE và DTEND là ngày SAU ngày cuối", () => {
    const { events } = parse(buildIcs({
      calName: "x", now: NOW,
      events: [
        { uid: "a", summary: "Một ngày", allDay: true, start: { year: 2026, month: 11, day: 12 } },
        { uid: "b", summary: "Ba ngày", allDay: true, start: { year: 2026, month: 12, day: 30 }, end: { year: 2027, month: 1, day: 1 } },
      ],
    }));
    expect(events[0]["DTSTART;VALUE=DATE"]).toBe("20261112");
    expect(events[0]["DTEND;VALUE=DATE"]).toBe("20261113");
    expect(events[1]["DTSTART;VALUE=DATE"]).toBe("20261230");
    expect(events[1]["DTEND;VALUE=DATE"]).toBe("20270102");
    expect(events[0].TRANSP).toBe("TRANSPARENT");
  });
  it("sự kiện huỷ có STATUS:CANCELLED", () => {
    const { events } = parse(buildIcs({ calName: "x", now: NOW, events: [{ uid: "a", summary: "Huỷ", status: "CANCELLED", start: new Date("2026-11-11T16:00:00Z") }] }));
    expect(events[0].STATUS).toBe("CANCELLED");
  });
  it("kết thúc dòng CRLF, không có LF trần; bắt đầu/kết thúc đúng", () => {
    const ics = buildIcs({ calName: "x", now: NOW, events: [{ uid: "a", summary: "x", start: new Date("2026-11-11T16:00:00Z") }] });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(/(^|[^\r])\n/.test(ics)).toBe(false);
  });
  it("UID chỉ giữ ký tự an toàn; tên tệp không dấu", () => {
    expect(parse(buildIcs({ calName: "x", now: NOW, events: [{ uid: "a b\r\nX:y", summary: "x", start: NOW }] })).events[0].UID).toBe("a-b--X:y");
    expect(icsFileName("Lịch Gia Đình Nguyễn", new Date("2026-10-28T10:00:00Z"))).toBe("lich-gia-dinh-nguyen-20261028.ics");
    expect(icsFileName("!!!", NOW)).toBe("lich-20261028.ics");
  });
  it("định dạng ngày giờ", () => {
    expect(formatUtc(new Date("2026-01-02T03:04:05Z"))).toBe("20260102T030405Z");
    expect(formatDateValue({ year: 2026, month: 1, day: 2 })).toBe("20260102");
  });
});
