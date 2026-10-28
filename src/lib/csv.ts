// Dựng CSV an toàn cho Excel: có BOM UTF-8, thoát dấu nháy, và chặn "chèn công thức" (CSV injection).

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "boolean" ? (value ? "Có" : "") : String(value);
  // Ô bắt đầu bằng = + - @ hoặc tab/CR có thể bị Excel hiểu là công thức -> thêm dấu nháy đơn phía trước
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Ngày dương cho CSV: "1950", "05/1950", "10/05/1950" hoặc "10/05" (không có năm). Rỗng nếu không có gì. */
export function csvSolarDate(y: number | null, m: number | null, d: number | null): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (m == null) return y != null ? String(y) : "";
  if (d == null) return y != null ? `${pad(m)}/${y}` : `${pad(m)}`;
  return y != null ? `${pad(d)}/${pad(m)}/${y}` : `${pad(d)}/${pad(m)}`;
}

/** Ngày âm cho CSV: "15/03" hoặc "15/03 nhuận" (tháng nhuận). */
export function csvLunarDate(y: number | null, m: number | null, d: number | null, leap: boolean): string {
  if (m == null) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const core = d == null ? `tháng ${pad(m)}` : `${pad(d)}/${pad(m)}`;
  return `${core}${leap ? " nhuận" : ""}${y != null ? `/${y}` : ""}`;
}
