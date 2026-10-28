// Hàm thuần: nhãn tiếng Việt, định dạng ngày, bỏ dấu để tìm kiếm, màu nhánh... (không phụ thuộc máy chủ)
import type { Gender, ParentKind, PartnerStatus, Visibility } from "./members-types";

export const GENDER_LABELS: Record<Gender, string> = { male: "Nam", female: "Nữ", other: "Khác" };
export const VISIBILITY_LABELS: Record<Visibility, string> = {
  family: "Cả gia đình",
  branch: "Chỉ trong nhánh",
  admins: "Chỉ quản trị viên",
};
export const PARENT_KIND_LABELS: Record<ParentKind, string> = { biological: "ruột", adoptive: "nuôi", step: "kế" };
export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  married: "Đang kết hôn",
  divorced: "Đã ly hôn",
  widowed: "Góa (một người đã mất)",
  partner: "Chung sống",
};
export const BIRTHDAY_MODE_LABELS = { solar: "Dương lịch", lunar: "Âm lịch", both: "Cả hai" } as const;
export const REQUEST_KIND_LABELS = {
  update_member: "Sửa hồ sơ",
  create_member: "Thêm thành viên",
  delete_member: "Xóa hồ sơ",
  add_parent: "Thêm cha/mẹ",
  add_partner: "Thêm vợ/chồng",
  remove_link: "Gỡ quan hệ",
} as const;
export const REQUEST_STATUS_LABELS = {
  pending: "Đang chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  cancelled: "Đã hủy",
} as const;

/** Bỏ dấu tiếng Việt, hạ chữ thường: "Nguyễn Đức" -> "nguyen duc". */
export function foldVietnamese(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const ACCENT_CLASSES: Record<string, string> = {
  a: "aàáảãạăằắẳẵặâầấẩẫậ",
  d: "dđ",
  e: "eèéẻẽẹêềếểễệ",
  i: "iìíỉĩị",
  o: "oòóỏõọôồốổỗộơờớởỡợ",
  u: "uùúủũụưừứửữự",
  y: "yỳýỷỹỵ",
};

/**
 * Tạo biểu thức chính quy (dùng với toán tử imatch của PostgREST) tìm không phân biệt dấu:
 * gõ "nguyen" vẫn thấy "Nguyễn". Chỉ giữ chữ, số, khoảng trắng và dấu gạch ngang để không cần thoát ký tự
 * (tránh lỗi cú pháp và ReDoS). Trả về chuỗi rỗng nếu không còn gì để tìm.
 */
export function accentInsensitivePattern(query: string, maxLen = 40): string {
  const cleaned = query.normalize("NFC").slice(0, maxLen).replace(/[^\p{L}\p{N} -]/gu, " ").replace(/\s+/g, " ").trim();
  let out = "";
  for (const ch of cleaned) {
    const base = foldVietnamese(ch);
    const cls = ACCENT_CLASSES[base];
    if (cls && base.length === 1) {
      const upper = cls.toUpperCase();
      // Nếu người dùng gõ có dấu thì chỉ khớp đúng ký tự đó (tìm chính xác hơn)
      out += ch === base || ch === base.toUpperCase() ? `[${cls}${upper}]` : `[${ch.toLowerCase()}${ch.toUpperCase()}]`;
    } else if (ch === " ") out += " ";
    else out += ch;
  }
  return out;
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = Array.from(words[0])[0] ?? "?";
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Màu ổn định theo mã nhánh (độ sáng cố định để chữ luôn đọc được). */
export function branchColor(id: string | null | undefined): string {
  if (!id) return "hsl(30 12% 55%)";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 45% 38%)`;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatSolar(y: number | null, m: number | null, d: number | null): string | null {
  if (y == null && m == null && d == null) return null;
  if (m == null) return y != null ? `năm ${y}` : null;
  if (d == null) return y != null ? `tháng ${m}/${y}` : `tháng ${m}`;
  return y != null ? `${pad(d)}/${pad(m)}/${y}` : `${pad(d)}/${pad(m)}`;
}

export function formatLunar(y: number | null, m: number | null, d: number | null, leap: boolean): string | null {
  if (m == null) return null;
  const mm = `${m}${leap ? " (nhuận)" : ""}`;
  const base = d == null ? `tháng ${mm}` : `ngày ${d} tháng ${mm}`;
  return y != null ? `${base} năm ${y}` : base;
}

export function lifeSpan(by: number | null, dy: number | null, dead: boolean): string {
  if (dead) return `${by ?? "?"} – ${dy ?? "?"}`;
  return by != null ? `sinh ${by}` : "";
}

/** Tuổi hoặc thọ (khi biết đủ năm). */
export function ageText(by: number | null, dy: number | null, dead: boolean, nowYear = new Date().getFullYear()): string | null {
  if (by == null) return null;
  if (dead) return dy != null && dy >= by ? `thọ ${dy - by} tuổi` : null;
  return `${nowYear - by} tuổi`;
}

/** Ngày hợp lệ theo lịch dương (cho phép 29/2 khi không có năm). */
export function isValidSolarDate(y: number | null, m: number | null, d: number | null): boolean {
  if (m == null) return d == null;
  if (m < 1 || m > 12) return false;
  if (d == null) return true;
  const year = y ?? 2000;
  const dim = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return d >= 1 && d <= dim;
}
