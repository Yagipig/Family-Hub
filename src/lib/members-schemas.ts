// Schema zod + hàm đọc/so sánh dữ liệu biểu mẫu thành viên (thuần, không phụ thuộc máy chủ).
import { z } from "zod";
import { isValidSolarDate } from "./members-text";
import type { FieldAccess, MemberRow } from "./members-types";

// ---------- Nhóm trường của biểu mẫu ----------
export const GROUP_FIELDS = {
  basic: ["full_name", "nickname", "alt_names", "gender", "branch_id"],
  other: ["hometown", "generation_title", "generation_no", "bio"],
  birth: [
    "birth_solar_year", "birth_solar_month", "birth_solar_day",
    "birth_lunar_year", "birth_lunar_month", "birth_lunar_day", "birth_lunar_leap", "birthday_mode",
  ],
  death: [
    "is_deceased", "death_solar_year", "death_solar_month", "death_solar_day",
    "death_lunar_month", "death_lunar_day", "death_lunar_leap",
  ],
  contact: ["phone", "email"],
  visibility: ["birth_visibility", "death_visibility", "contact_visibility", "photo_visibility"],
} as const;
export type GroupName = keyof typeof GROUP_FIELDS;
export const ALL_GROUPS = Object.keys(GROUP_FIELDS) as GroupName[];
const BOOL_FIELDS = new Set(["birth_lunar_leap", "is_deceased", "death_lunar_leap"]);
const NUMBER_FIELDS = new Set([
  "birth_solar_year", "birth_solar_month", "birth_solar_day", "birth_lunar_year", "birth_lunar_month", "birth_lunar_day",
  "death_solar_year", "death_solar_month", "death_solar_day", "death_lunar_month", "death_lunar_day", "generation_no",
]);

// ---------- Schema ----------
const text = (max: number, label: string) =>
  z.string({ error: `${label} chưa hợp lệ` }).trim().max(max, `${label} quá dài (tối đa ${max} ký tự)`).nullable().optional();
const num = (min: number, max: number, label: string) =>
  z.number({ error: `${label} phải là một số` }).int(`${label} phải là số nguyên`)
    .min(min, `${label} phải từ ${min} đến ${max}`).max(max, `${label} phải từ ${min} đến ${max}`).nullable().optional();
const year = (label: string) => num(1000, 2200, label);
const vis = z.enum(["family", "branch", "admins"], { error: "Mức hiển thị không hợp lệ" }).optional();

export const memberFieldsSchema = z.object({
  full_name: z.string({ error: "Vui lòng nhập họ tên" }).trim().min(1, "Vui lòng nhập họ tên").max(160, "Họ tên quá dài (tối đa 160 ký tự)").optional(),
  nickname: text(80, "Tên thường gọi"),
  alt_names: text(160, "Tên gọi khác"),
  gender: z.enum(["male", "female", "other"], { error: "Giới tính không hợp lệ" }).nullable().optional(),
  branch_id: z.uuid({ error: "Nhánh không hợp lệ" }).nullable().optional(),
  hometown: text(200, "Quê quán"),
  generation_title: text(80, "Tên đời / bối"),
  generation_no: num(1, 60, "Đời (số thứ tự)"),
  bio: text(5000, "Tiểu sử"),
  birth_solar_year: year("Năm sinh dương lịch"),
  birth_solar_month: num(1, 12, "Tháng sinh dương lịch"),
  birth_solar_day: num(1, 31, "Ngày sinh dương lịch"),
  birth_lunar_year: year("Năm sinh âm lịch"),
  birth_lunar_month: num(1, 12, "Tháng sinh âm lịch"),
  birth_lunar_day: num(1, 30, "Ngày sinh âm lịch"),
  birth_lunar_leap: z.boolean().optional(),
  birthday_mode: z.enum(["solar", "lunar", "both"], { error: "Kiểu sinh nhật không hợp lệ" }).optional(),
  is_deceased: z.boolean().optional(),
  death_solar_year: year("Năm mất dương lịch"),
  death_solar_month: num(1, 12, "Tháng mất dương lịch"),
  death_solar_day: num(1, 31, "Ngày mất dương lịch"),
  death_lunar_month: num(1, 12, "Tháng mất âm lịch"),
  death_lunar_day: num(1, 30, "Ngày mất âm lịch"),
  death_lunar_leap: z.boolean().optional(),
  phone: z.string({ error: "Số điện thoại chưa hợp lệ" }).trim().max(40, "Số điện thoại quá dài")
    .refine((v) => v === "" || /^[0-9+()\-.\s]{3,40}$/.test(v), "Số điện thoại chỉ gồm chữ số, dấu +, -, ., khoảng trắng và ngoặc")
    .nullable().optional(),
  email: z.string({ error: "Email chưa hợp lệ" }).trim().max(254, "Email quá dài")
    .refine((v) => v === "" || z.email().safeParse(v).success, "Email chưa hợp lệ").nullable().optional(),
  birth_visibility: vis,
  death_visibility: vis,
  contact_visibility: vis,
  photo_visibility: vis,
}).superRefine((v, ctx) => {
  const add = (message: string, path: string) => ctx.addIssue({ code: "custom", message, path: [path] });
  if (v.birth_solar_day != null && v.birth_solar_month == null) add("Nhập tháng sinh dương lịch trước khi nhập ngày", "birth_solar_month");
  if (v.birth_lunar_day != null && v.birth_lunar_month == null) add("Nhập tháng sinh âm lịch trước khi nhập ngày", "birth_lunar_month");
  if (v.death_solar_day != null && v.death_solar_month == null) add("Nhập tháng mất dương lịch trước khi nhập ngày", "death_solar_month");
  if (v.death_lunar_day != null && v.death_lunar_month == null) add("Nhập tháng mất âm lịch trước khi nhập ngày", "death_lunar_month");
  if (!isValidSolarDate(v.birth_solar_year ?? null, v.birth_solar_month ?? null, v.birth_solar_day ?? null))
    add("Ngày sinh dương lịch không có thật trong lịch", "birth_solar_day");
  if (!isValidSolarDate(v.death_solar_year ?? null, v.death_solar_month ?? null, v.death_solar_day ?? null))
    add("Ngày mất dương lịch không có thật trong lịch", "death_solar_day");
  if (v.birth_solar_year != null && v.death_solar_year != null && v.death_solar_year < v.birth_solar_year)
    add("Năm mất không thể trước năm sinh", "death_solar_year");
  const mode = v.birthday_mode;
  const hasSolar = v.birth_solar_month != null && v.birth_solar_day != null;
  const hasLunar = v.birth_lunar_month != null && v.birth_lunar_day != null;
  // Chỉ nhắc khi người dùng đã nhập ngày của lịch KIA nhưng chưa nhập đủ ngày của lịch mà kiểu sinh nhật yêu cầu.
  // (Chỉ có năm sinh thì vẫn hợp lệ: người lớn tuổi thường chỉ nhớ năm.)
  if (mode && (mode === "solar" || mode === "both") && !hasSolar && hasLunar)
    add("Sinh nhật theo dương lịch cần có tháng và ngày dương (hoặc đổi kiểu sinh nhật sang “Âm lịch”)", "birth_solar_month");
  if (mode && (mode === "lunar" || mode === "both") && !hasLunar && hasSolar)
    add("Sinh nhật theo âm lịch cần có tháng và ngày âm (hoặc đổi kiểu sinh nhật sang “Dương lịch”)", "birth_lunar_month");
});

export type MemberFields = z.infer<typeof memberFieldsSchema>;
export type MemberFieldKey = keyof MemberFields;

// ---------- Đọc biểu mẫu ----------
type Raw = Record<string, unknown>;

/** Nhóm nào được gửi lên: trường `groups` = "basic,birth,..." do biểu mẫu tạo ra (nhóm bị che không được gửi). */
export function readGroups(formData: FormData): GroupName[] {
  const raw = String(formData.get("groups") ?? "");
  return raw.split(",").filter((g): g is GroupName => (ALL_GROUPS as string[]).includes(g));
}

/** Gom dữ liệu thô từ FormData: chuỗi rỗng -> null; số -> number (hoặc giữ chuỗi nếu không phải số để zod báo lỗi). */
export function collectRaw(formData: FormData, groups: GroupName[]): Raw {
  const raw: Raw = {};
  for (const g of groups) {
    for (const key of GROUP_FIELDS[g]) {
      if (BOOL_FIELDS.has(key)) {
        raw[key] = formData.get(key) === "on";
        continue;
      }
      const v = formData.get(key);
      if (v === null || typeof v !== "string") continue; // không gửi (ví dụ ô bị tắt) => không đổi
      const s = v.trim();
      if (NUMBER_FIELDS.has(key)) {
        raw[key] = s === "" ? null : /^-?\d+$/.test(s) ? Number(s) : s;
      } else if (key === "full_name" || key === "birthday_mode" || key.endsWith("_visibility")) {
        raw[key] = s; // bắt buộc: chuỗi rỗng sẽ bị schema từ chối
      } else {
        raw[key] = s === "" ? null : s;
      }
    }
  }
  return raw;
}

export type ParsedMember = { ok: true; data: MemberFields; groups: GroupName[] } | { ok: false; error: string };

export function parseMemberForm(formData: FormData): ParsedMember {
  const groups = readGroups(formData);
  if (groups.length === 0) return { ok: false, error: "Biểu mẫu không hợp lệ." };
  const raw = collectRaw(formData, groups);
  const parsed = memberFieldsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  const data: MemberFields = { ...parsed.data };
  // Chưa đánh dấu "đã mất" => xóa mọi thông tin ngày mất (đúng ràng buộc CSDL)
  if (groups.includes("death") && data.is_deceased === false) {
    data.death_solar_year = null; data.death_solar_month = null; data.death_solar_day = null;
    data.death_lunar_month = null; data.death_lunar_day = null; data.death_lunar_leap = false;
  }
  return { ok: true, data, groups };
}

// ---------- So sánh với bản gốc ----------
const norm = (v: unknown): unknown => (v === undefined || v === "" ? null : v);

/** Chỉ các trường thật sự đổi; bỏ qua nhóm bị che (không xem được) để không ghi đè dữ liệu ẩn. */
export function diffMember(original: Partial<MemberRow>, next: MemberFields, access: FieldAccess): Record<string, unknown> {
  const blocked = new Set<string>();
  if (!access.birth) GROUP_FIELDS.birth.forEach((k) => blocked.add(k));
  if (!access.death) GROUP_FIELDS.death.forEach((k) => blocked.add(k));
  if (!access.contact) GROUP_FIELDS.contact.forEach((k) => blocked.add(k));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || blocked.has(key)) continue;
    const before = norm((original as Record<string, unknown>)[key]);
    const after = norm(value);
    if (before !== after) out[key] = after;
  }
  return out;
}

/** Dữ liệu tạo mới: bỏ các trường rỗng/null để RPC dùng giá trị mặc định. */
export function createPayload(data: MemberFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
}

/** Chỉ cho phép các khóa này trong yêu cầu sửa do giao diện tạo ra (avatar_path không bao giờ do biểu mẫu gửi). */
export const EDITABLE_KEYS: string[] = Object.values(GROUP_FIELDS).flat();

// ---------- Schema các hành động khác ----------
export const idSchema = z.uuid();
export const noteSchema = z.string().trim().max(1000, "Ghi chú tối đa 1000 ký tự").transform((v) => v || null);
const optId = z.union([z.literal(""), z.uuid()]).transform((v) => v || null);
const optYear = z.union([z.literal(""), z.coerce.number().int().min(1000).max(2200)]).transform((v) => (v === "" ? null : v));

export const addParentSchema = z.object({
  childId: z.uuid({ error: "Chưa chọn người con" }),
  parentId: z.uuid({ error: "Hãy chọn một người trong danh sách" }),
  kind: z.enum(["biological", "adoptive", "step"], { error: "Loại quan hệ không hợp lệ" }),
}).refine((v) => v.childId !== v.parentId, { message: "Không thể là cha/mẹ của chính mình" });

export const addPartnerSchema = z.object({
  aId: z.uuid({ error: "Chưa chọn người" }),
  bId: z.uuid({ error: "Hãy chọn một người trong danh sách" }),
  status: z.enum(["married", "divorced", "widowed", "partner"], { error: "Tình trạng không hợp lệ" }),
  startYear: optYear,
  endYear: optYear,
}).refine((v) => v.aId !== v.bId, { message: "Không thể là vợ/chồng của chính mình" })
  .refine((v) => v.startYear == null || v.endYear == null || v.endYear >= v.startYear, { message: "Năm kết thúc không thể trước năm bắt đầu" });

export const updatePartnerSchema = z.object({
  id: z.uuid(),
  status: z.enum(["married", "divorced", "widowed", "partner"]),
  startYear: optYear,
  endYear: optYear,
}).refine((v) => v.startYear == null || v.endYear == null || v.endYear >= v.startYear, { message: "Năm kết thúc không thể trước năm bắt đầu" });

export const requestNoteField = noteSchema;
export const relTargetSchema = z.object({ rel: z.enum(["", "child", "parent", "partner"]), relTo: optId });

export const reviewSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  note: noteSchema,
});

export const linkAccountSchema = z.object({ membershipId: z.uuid(), memberId: optId });

// ---------- Tham số trang danh sách ----------
export type ListParams = { q: string; branch: string; gender: "" | "male" | "female" | "other"; alive: "" | "alive" | "deceased"; page: number };

export function parseListParams(sp: Record<string, string | string[] | undefined>): ListParams {
  const one = (k: string) => { const v = sp[k]; return typeof v === "string" ? v : ""; };
  const q = one("q").trim().slice(0, 40);
  const branchRaw = one("branch");
  const branch = branchRaw === "none" || z.uuid().safeParse(branchRaw).success ? branchRaw : "";
  const g = one("gender");
  const gender = g === "male" || g === "female" || g === "other" ? g : "";
  const a = one("alive");
  const alive = a === "alive" || a === "deceased" ? a : "";
  const p = Number.parseInt(one("page"), 10);
  const page = Number.isFinite(p) && p >= 1 && p <= 10000 ? p : 1;
  return { q, branch, gender, alive, page };
}

// ---------- Tệp nhập JSON ----------
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_MEMBERS = 2000;

const importMember = z.object({
  id: z.union([z.string().min(1).max(100), z.number()]).transform(String),
  full_name: z.string().trim().min(1, "thiếu họ tên").max(160, "họ tên quá dài"),
  nickname: z.string().max(80).nullable().optional(),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  branch: z.string().max(120).nullable().optional(),
  birth_solar_year: z.number().int().min(1000).max(2200).nullable().optional(),
  birth_solar_month: z.number().int().min(1).max(12).nullable().optional(),
  birth_solar_day: z.number().int().min(1).max(31).nullable().optional(),
  birth_lunar_year: z.number().int().min(1000).max(2200).nullable().optional(),
  birth_lunar_month: z.number().int().min(1).max(12).nullable().optional(),
  birth_lunar_day: z.number().int().min(1).max(30).nullable().optional(),
  birth_lunar_leap: z.boolean().nullable().optional(),
  birthday_mode: z.enum(["solar", "lunar", "both"]).nullable().optional(),
  is_deceased: z.boolean().nullable().optional(),
  death_solar_year: z.number().int().min(1000).max(2200).nullable().optional(),
  death_solar_month: z.number().int().min(1).max(12).nullable().optional(),
  death_solar_day: z.number().int().min(1).max(31).nullable().optional(),
  death_lunar_month: z.number().int().min(1).max(12).nullable().optional(),
  death_lunar_day: z.number().int().min(1).max(30).nullable().optional(),
  death_lunar_leap: z.boolean().nullable().optional(),
  hometown: z.string().max(200).nullable().optional(),
  generation_title: z.string().max(80).nullable().optional(),
  generation_no: z.number().int().min(1).max(60).nullable().optional(),
  bio: z.string().max(5000).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().max(254).nullable().optional(),
  birth_visibility: z.enum(["family", "branch", "admins"]).nullable().optional(),
  death_visibility: z.enum(["family", "branch", "admins"]).nullable().optional(),
  contact_visibility: z.enum(["family", "branch", "admins"]).nullable().optional(),
  photo_visibility: z.enum(["family", "branch", "admins"]).nullable().optional(),
  // KHÔNG nhận avatar_path từ tệp ngoài: đường dẫn kho ảnh do hệ thống cấp, không tin dữ liệu bên ngoài.
});

const refId = z.union([z.string().min(1).max(100), z.number()]).transform(String);

export const importFileSchema = z.object({
  version: z.literal(1, { error: "Tệp phải có “version”: 1 (xuất từ chức năng Xuất gia phả)" }),
  members: z.array(importMember).max(IMPORT_MAX_MEMBERS, `Tệp có quá ${IMPORT_MAX_MEMBERS} thành viên`),
  parents: z.array(z.object({
    child: refId, parent: refId, kind: z.enum(["biological", "adoptive", "step"]).optional(),
  })).max(20000).optional(),
  partners: z.array(z.object({
    a: refId, b: refId,
    status: z.enum(["married", "divorced", "widowed", "partner"]).optional(),
    start_year: z.number().int().min(1000).max(2200).nullable().optional(),
    end_year: z.number().int().min(1000).max(2200).nullable().optional(),
  })).max(20000).optional(),
});
export type ImportFile = z.infer<typeof importFileSchema>;

/** Kiểm tra văn bản JSON của tệp nhập; trả về dữ liệu đã làm sạch hoặc lỗi tiếng Việt. */
export function parseImportText(text: string): { ok: true; data: ImportFile } | { ok: false; error: string } {
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { ok: false, error: "Tệp không phải JSON hợp lệ." }; }
  const r = importFileSchema.safeParse(json);
  if (!r.success) {
    const issues = r.error.issues.slice(0, 3).map((i) => {
      const [first, idx, field] = i.path;
      const where = first === "members" && typeof idx === "number"
        ? `Thành viên thứ ${idx + 1}${field ? ` (mục ${String(field)})` : ""}`
        : first ? `Mục “${String(first)}”${typeof idx === "number" ? ` dòng ${idx + 1}` : ""}` : "Tệp";
      return `${where}: ${i.message}`;
    });
    return { ok: false, error: `Tệp chưa đúng định dạng. ${issues.join("; ")}.` };
  }
  const ids = new Set<string>();
  for (const m of r.data.members) {
    if (ids.has(m.id)) return { ok: false, error: `Mã thành viên bị trùng trong tệp: “${m.id}”.` };
    ids.add(m.id);
  }
  return { ok: true, data: r.data };
}

/** Kiểm tra Origin để chặn gửi form chéo trang (lớp bổ sung ngoài cookie SameSite). */
export function sameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin) return true; // trình duyệt không gửi Origin với một số điều hướng cùng trang
  if (!host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
