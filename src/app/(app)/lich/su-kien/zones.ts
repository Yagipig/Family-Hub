import { COUNTRIES } from "@/lib/countries";

/** Danh sách múi giờ gọn cho biểu mẫu (từ bảng quốc gia); luôn gồm múi giờ đang dùng. */
export function zoneOptions(current: string): { value: string; label: string }[] {
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];
  for (const c of COUNTRIES) {
    for (const z of c.zones) {
      if (seen.has(z)) continue;
      seen.add(z);
      out.push({ value: z, label: `${c.name} (${z.replace(/_/g, " ")})` });
    }
  }
  if (!seen.has(current)) out.unshift({ value: current, label: current.replace(/_/g, " ") });
  return out.sort((a, b) => a.label.localeCompare(b.label, "vi"));
}
