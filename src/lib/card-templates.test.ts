import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CARD_TEMPLATES, EFFECT_LABELS, OCCASIONS, SUGGESTED_MESSAGES, getTemplate, isTemplateKey } from "./card-templates";

const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/20261031000001_cards_templates.sql", import.meta.url)), "utf8");

type Row = { key: string; name: string; occasion: string; effect: string; motif: string; palette: Record<string, string>; sortOrder: number };
function seedRows(): Row[] {
  const rows: Row[] = [];
  const re = /^\('([a-z0-9-]+)', '([^']+)', '([a-z-]+)', '([a-z]+)', '([a-z-]+)', '(\{[^']*\})'::jsonb, (\d+)\)[,;]\s*$/gm;
  for (const m of sql.matchAll(re)) {
    rows.push({ key: m[1], name: m[2], occasion: m[3], effect: m[4], motif: m[5], palette: JSON.parse(m[6]), sortOrder: Number(m[7]) });
  }
  return rows;
}

describe("thư viện mẫu thiệp", () => {
  it("có ít nhất 8 mẫu, đủ 4 hiệu ứng và nhiều dịp", () => {
    expect(CARD_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(CARD_TEMPLATES.map((t) => t.effect))).toEqual(new Set(Object.keys(EFFECT_LABELS)));
    expect(new Set(CARD_TEMPLATES.map((t) => t.occasion)).size).toBeGreaterThanOrEqual(5);
  });
  it("khóa duy nhất, đúng định dạng; dịp hợp lệ; màu là #rrggbb", () => {
    const keys = CARD_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of CARD_TEMPLATES) {
      expect(t.key).toMatch(/^[a-z0-9-]{3,40}$/);
      expect(Object.keys(OCCASIONS)).toContain(t.occasion);
      for (const c of Object.values(t.palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it("ĐỒNG BỘ với seed trong migration (khóa, tên, dịp, hiệu ứng, họa tiết, bảng màu, thứ tự)", () => {
    const rows = seedRows();
    expect(rows.length).toBe(CARD_TEMPLATES.length);
    for (const t of CARD_TEMPLATES) {
      const r = rows.find((x) => x.key === t.key);
      expect(r, `migration thiếu mẫu ${t.key}`).toBeDefined();
      expect(r).toEqual({ key: t.key, name: t.name, occasion: t.occasion, effect: t.effect, motif: t.motif, palette: t.palette, sortOrder: t.sortOrder });
    }
  });
  it("độ tương phản chữ/nền đủ đọc cho người lớn tuổi (>= 4.5 trên cả hai màu nền)", () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    for (const t of CARD_TEMPLATES) {
      expect(ratio(t.palette.text, t.palette.bg), `${t.key} / bg`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.palette.text, t.palette.bg2), `${t.key} / bg2`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("getTemplate/isTemplateKey và lời chúc gợi ý cho mọi dịp", () => {
    expect(getTemplate("tet-phong-bao").name).toBe("Phong bao đỏ");
    expect(getTemplate("khong-co").key).toBe(CARD_TEMPLATES[0].key);
    expect(isTemplateKey("tet-hoa-mai")).toBe(true);
    expect(isTemplateKey("x")).toBe(false);
    for (const o of Object.keys(OCCASIONS)) expect(SUGGESTED_MESSAGES[o as keyof typeof OCCASIONS].length).toBeGreaterThan(20);
  });
});
