// Dữ liệu tháng âm lịch trong migration SQL (supabase/migrations/20261030000002_lunar_months_data.sql) PHẢI khớp lunar.ts.
// Sinh lại file SQL sau khi sửa thuật toán:   GEN_LUNAR_SQL=1 npx vitest run src/lib/lunar-sql-data.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { jdToSolar, solarKey, solarToJd, solarToLunar } from "./lunar";

const FILE = new URL("../../supabase/migrations/20261030000002_lunar_months_data.sql", import.meta.url);

type Row = { start: string; year: number; month: number; leap: boolean; days: number };

function buildRows(): Row[] {
  const first = solarToJd(1900, 1, 1);
  const last = solarToJd(2100, 12, 31);
  const l0 = solarToLunar(1900, 1, 1);
  const startJd = first - (l0.day - 1);
  const marks: Array<{ jd: number; year: number; month: number; leap: boolean }> = [
    { jd: startJd, year: l0.year, month: l0.month, leap: l0.leap },
  ];
  for (let jd = startJd + 1; jd <= last + 40; jd++) {
    const s = jdToSolar(jd);
    const l = solarToLunar(s.year, s.month, s.day);
    if (l.day === 1) marks.push({ jd, year: l.year, month: l.month, leap: l.leap });
  }
  const out: Row[] = [];
  for (let i = 0; i < marks.length - 1; i++) {
    if (marks[i].jd > last) break;
    out.push({
      start: solarKey(jdToSolar(marks[i].jd)), year: marks[i].year, month: marks[i].month, leap: marks[i].leap,
      days: marks[i + 1].jd - marks[i].jd,
    });
  }
  return out;
}

function render(rows: Row[]): string {
  const lines = rows.map((r) => `('${r.start}',${r.year},${r.month},${r.leap ? "true" : "false"},${r.days})`);
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += 6) chunks.push("  " + lines.slice(i, i + 6).join(", "));
  return `-- Su kien / Lich / migration 2: du lieu thang am lich Viet Nam (tham chieu, KHONG sua tay).
-- Sinh tu src/lib/lunar.ts boi src/lib/lunar-sql-data.test.ts (GEN_LUNAR_SQL=1): ${rows.length} thang, tu ${rows[0].start} den thang chua 2100-12-31.
-- Moi dong: ngay duong cua mung 1, nam am, thang am, nhuan?, so ngay (29/30).
-- Mui gio: UTC+8 truoc 8/8/1967, UTC+7 tu do (xem comment dau lunar.ts).
insert into public.lunar_months (start_date, lunar_year, lunar_month, is_leap, days) values
${chunks.join(",\n")};
`;
}

describe("lunar_months (SQL) khớp lunar.ts", () => {
  const rows = buildRows();
  if (process.env.GEN_LUNAR_SQL) writeFileSync(FILE, render(rows));

  it("các tháng liền nhau, không hở/chồng, độ dài 29 hoặc 30", () => {
    expect(rows.length).toBeGreaterThan(2400);
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const [y, m, d] = prev.start.split("-").map(Number);
      expect(solarKey(jdToSolar(solarToJd(y, m, d) + prev.days))).toBe(rows[i].start);
      expect([29, 30]).toContain(prev.days);
    }
  });

  it("file migration SQL đúng bằng dữ liệu sinh từ lunar.ts", () => {
    const text = readFileSync(FILE, "utf8");
    const parsed = [...text.matchAll(/\('(\d{4}-\d{2}-\d{2})',(\d+),(\d+),(true|false),(\d+)\)/g)].map((m) => ({
      start: m[1], year: +m[2], month: +m[3], leap: m[4] === "true", days: +m[5],
    }));
    expect(parsed.length).toBe(rows.length);
    expect(parsed).toEqual(rows);
  });
});
