/** Tuỳ chọn thông báo: kiểm tra đầu vào (thuần TS, kiểm thử được). Khớp CHECK của notification_preferences. */
export const LEAD_CHOICES = [0, 1, 2, 3, 5, 7, 14, 30] as const;
export const MAX_LEADS = 6;
export const DEFAULT_LEADS = [0, 1, 7];

export const LEAD_LABEL: Record<number, string> = {
  0: "Đúng hôm đó", 1: "Trước 1 ngày", 2: "Trước 2 ngày", 3: "Trước 3 ngày", 5: "Trước 5 ngày",
  7: "Trước 1 tuần", 14: "Trước 2 tuần", 30: "Trước 1 tháng",
};

export type PrefsInput = {
  birthdays: boolean; leads: number[]; death: boolean; events: boolean; cards: boolean; gifts: boolean; chat: boolean;
};

export function parsePrefs(formData: { getAll(name: string): FormDataEntryValue[]; get(name: string): FormDataEntryValue | null }):
  { ok: true; value: PrefsInput } | { ok: false; error: string } {
  const on = (name: string) => formData.get(name) === "on";
  const leads = [...new Set(formData.getAll("lead").map((v) => Number(v)))];
  if (leads.some((n) => !(LEAD_CHOICES as readonly number[]).includes(n))) return { ok: false, error: "Số ngày nhắc trước chưa hợp lệ." };
  if (leads.length > MAX_LEADS) return { ok: false, error: `Chỉ chọn tối đa ${MAX_LEADS} mốc nhắc trước.` };
  leads.sort((a, b) => a - b);
  return {
    ok: true,
    value: { birthdays: on("birthdays"), leads, death: on("death"), events: on("events"), cards: on("cards"), gifts: on("gifts"), chat: on("chat") },
  };
}
