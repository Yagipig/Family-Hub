/**
 * Xuất iCalendar (RFC 5545) — thuần TypeScript, kiểm thử được.
 *  - Thời gian có giờ ghi theo UTC (hậu tố Z) nên KHÔNG cần VTIMEZONE và không lệch khi nhập vào Google/Apple/Outlook.
 *  - Sự kiện cả ngày / sinh nhật / ngày giỗ ghi bằng DTSTART;VALUE=DATE (ngày lịch, không phụ thuộc múi giờ);
 *    DTEND của sự kiện cả ngày là NGÀY SAU ngày cuối (exclusive) đúng chuẩn.
 *  - Sự kiện lặp (hằng năm theo dương/âm lịch) được TRẢI thành từng VEVENT riêng cho một cửa sổ thời gian,
 *    vì RRULE không diễn tả được âm lịch và RRULE theo UTC sẽ trôi 1 giờ qua mùa hè ở múi giờ có DST.
 *  - Mọi giá trị văn bản được thoát ký tự đúng chuẩn (\\ ; , xuống dòng) và loại ký tự điều khiển: nội dung do người dùng
 *    nhập không thể chèn thêm thuộc tính/sự kiện giả vào tệp.
 *  - Dòng dài được gấp ở 75 octet (UTF-8, không cắt giữa ký tự), kết thúc dòng CRLF.
 */
import { type SolarDate, addDays } from "./lunar";

export type IcsEvent = {
  uid: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  /** true: ngày lịch (start/end là SolarDate); false: thời điểm tuyệt đối (start/end là Date). */
  allDay?: boolean;
  start: Date | SolarDate;
  /** Với cả ngày: ngày CUỐI CÙNG của sự kiện (gồm cả ngày đó); hàm sẽ tự đổi sang DTEND exclusive. */
  end?: Date | SolarDate | null;
  status?: "CONFIRMED" | "CANCELLED";
  categories?: string[];
  url?: string;
};

const CRLF = "\r\n";

/** Loại ký tự điều khiển (trừ xuống dòng, sẽ được thoát) rồi thoát theo RFC 5545 mục 3.3.11. */
export function escapeText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Gấp dòng ở 75 octet; dòng tiếp bắt đầu bằng một dấu cách. Không cắt giữa ký tự UTF-8. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {            // lặp theo điểm mã (không tách cặp thay thế)
    const b = enc.encode(ch).length;
    if (curBytes + b > limit) {
      parts.push(cur);
      cur = "";
      curBytes = 0;
      limit = 74;                     // dòng tiếp có thêm 1 octet là dấu cách đầu dòng
    }
    cur += ch;
    curBytes += b;
  }
  if (cur) parts.push(cur);
  return parts.join(CRLF + " ");
}

const p2 = (n: number) => String(n).padStart(2, "0");

export function formatUtc(d: Date): string {
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;
}

export function formatDateValue(s: SolarDate): string {
  return `${String(s.year).padStart(4, "0")}${p2(s.month)}${p2(s.day)}`;
}

function prop(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

export function buildIcs(input: { calName: string; events: IcsEvent[]; now?: Date; prodId?: string }): string {
  const now = input.now ?? new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    prop("PRODID", input.prodId ?? "-//Family Hub//Lich gia dinh//VI"),
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    prop("X-WR-CALNAME", escapeText(input.calName)),
  ];
  for (const ev of input.events) {
    lines.push("BEGIN:VEVENT");
    lines.push(prop("UID", sanitizeUid(ev.uid)));
    lines.push(`DTSTAMP:${formatUtc(now)}`);
    if (ev.allDay) {
      const s = ev.start as SolarDate;
      const last = (ev.end ?? ev.start) as SolarDate;
      lines.push(`DTSTART;VALUE=DATE:${formatDateValue(s)}`);
      lines.push(`DTEND;VALUE=DATE:${formatDateValue(addDays(last, 1))}`);
      lines.push("TRANSP:TRANSPARENT");
    } else {
      const s = ev.start as Date;
      lines.push(`DTSTART:${formatUtc(s)}`);
      if (ev.end) lines.push(`DTEND:${formatUtc(ev.end as Date)}`);
    }
    lines.push(prop("SUMMARY", escapeText(ev.summary)));
    if (ev.description) lines.push(prop("DESCRIPTION", escapeText(ev.description)));
    if (ev.location) lines.push(prop("LOCATION", escapeText(ev.location)));
    if (ev.categories && ev.categories.length > 0) lines.push(prop("CATEGORIES", ev.categories.map(escapeText).join(",")));
    if (ev.url) lines.push(prop("URL", ev.url.replace(/[\r\n]/g, "")));
    lines.push(`STATUS:${ev.status ?? "CONFIRMED"}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join(CRLF) + CRLF;
}

/** UID chỉ gồm ký tự an toàn. */
function sanitizeUid(uid: string): string {
  return uid.replace(/[^A-Za-z0-9@._:-]/g, "-");
}

/** Tên tệp tải về an toàn (không dấu, chỉ chữ-số-gạch). */
export function icsFileName(base: string, now: Date): string {
  const ascii = base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
  const safe = ascii.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "lich";
  return `${safe}-${now.getUTCFullYear()}${p2(now.getUTCMonth() + 1)}${p2(now.getUTCDate())}.ics`;
}
