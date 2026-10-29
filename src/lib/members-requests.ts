// Mô tả yêu cầu chỉnh sửa bằng tiếng Việt và so sánh giá trị cũ/mới (thuần, dùng được ở server component và test).
import {
  BIRTHDAY_MODE_LABELS, GENDER_LABELS, PARENT_KIND_LABELS, PARTNER_STATUS_LABELS, REQUEST_KIND_LABELS, VISIBILITY_LABELS,
} from "./members-text";
import type { ChangeRequestRow } from "./members-types";

export const FIELD_LABELS: Record<string, string> = {
  full_name: "Họ và tên", nickname: "Tên thường gọi", alt_names: "Tên gọi khác", gender: "Giới tính", branch_id: "Nhánh họ",
  hometown: "Quê quán", generation_title: "Tên đời / bối", generation_no: "Đời (số thứ tự)", bio: "Tiểu sử",
  birth_solar_year: "Năm sinh (dương)", birth_solar_month: "Tháng sinh (dương)", birth_solar_day: "Ngày sinh (dương)",
  birth_lunar_year: "Năm sinh (âm)", birth_lunar_month: "Tháng sinh (âm)", birth_lunar_day: "Ngày sinh (âm)",
  birth_lunar_leap: "Sinh vào tháng nhuận (âm)", birthday_mode: "Nhắc sinh nhật theo",
  is_deceased: "Đã mất", death_solar_year: "Năm mất (dương)", death_solar_month: "Tháng mất (dương)", death_solar_day: "Ngày mất (dương)",
  death_lunar_month: "Tháng mất (âm)", death_lunar_day: "Ngày mất (âm)", death_lunar_leap: "Mất vào tháng nhuận (âm)",
  phone: "Điện thoại", email: "Email",
  birth_visibility: "Ai xem được ngày sinh", death_visibility: "Ai xem được ngày mất",
  contact_visibility: "Ai xem được liên hệ", photo_visibility: "Ai xem được ảnh",
};

export type RequestContext = {
  members: Map<string, string>;
  links: Map<string, { child: string; parent: string; kind: keyof typeof PARENT_KIND_LABELS }>;
  partnerships: Map<string, { a: string; b: string; status: keyof typeof PARTNER_STATUS_LABELS }>;
  branches: Map<string, string>;
};

const UNKNOWN = "(không xem được)";
const nameOf = (ctx: RequestContext, id: unknown) => (typeof id === "string" ? (ctx.members.get(id) ?? UNKNOWN) : UNKNOWN);
const q = (s: string) => `“${s}”`;
const str = (v: unknown) => (typeof v === "string" ? v : "");

const labelMap: Record<string, Record<string, string>> = {
  gender: GENDER_LABELS, birthday_mode: BIRTHDAY_MODE_LABELS,
  birth_visibility: VISIBILITY_LABELS, death_visibility: VISIBILITY_LABELS,
  contact_visibility: VISIBILITY_LABELS, photo_visibility: VISIBILITY_LABELS,
};

export const EMPTY_TEXT = "(để trống)";

export function formatFieldValue(key: string, value: unknown, ctx: RequestContext): string {
  if (value === null || value === undefined || value === "") return EMPTY_TEXT;
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (key === "branch_id") return typeof value === "string" ? (ctx.branches.get(value) ?? "(nhánh không xác định)") : EMPTY_TEXT;
  const map = labelMap[key];
  if (map && typeof value === "string") return map[value] ?? value;
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.length > 600 ? `${value.slice(0, 600)}…` : value;
  const json = JSON.stringify(value);
  return json.length > 200 ? `${json.slice(0, 200)}…` : json;
}

export type FieldChange = { key: string; label: string; known: boolean; before: string | null; after: string };

/** So sánh payload của yêu cầu sửa với hồ sơ hiện tại (current = null thì chỉ hiện giá trị đề xuất). */
export function payloadChanges(
  r: Pick<ChangeRequestRow, "kind" | "payload">, current: Record<string, unknown> | null, ctx: RequestContext,
): FieldChange[] {
  const out: FieldChange[] = [];
  for (const [key, value] of Object.entries(r.payload ?? {})) {
    out.push({
      key, label: FIELD_LABELS[key] ?? key, known: key in FIELD_LABELS,
      before: current && r.kind === "update_member" ? formatFieldValue(key, current[key], ctx) : null,
      after: formatFieldValue(key, value, ctx),
    });
  }
  return out;
}

export function describeRequest(r: ChangeRequestRow, ctx: RequestContext): string {
  const p = (r.payload ?? {}) as Record<string, unknown>;
  switch (r.kind) {
    case "update_member": {
      const keys = Object.keys(p).map((k) => FIELD_LABELS[k] ?? k);
      return `Sửa hồ sơ ${q(nameOf(ctx, r.target_member_id))}: ${keys.length ? keys.join(", ") : "không có thay đổi"}`;
    }
    case "create_member": return `Thêm thành viên ${q(str(p.full_name) || "(chưa có tên)")}`;
    case "delete_member": return `Xóa hồ sơ ${q(nameOf(ctx, r.target_member_id))}`;
    case "add_parent": {
      const kind = PARENT_KIND_LABELS[str(p.kind) as keyof typeof PARENT_KIND_LABELS] ?? PARENT_KIND_LABELS.biological;
      return `${q(nameOf(ctx, p.parent_id))} là cha/mẹ ${kind} của ${q(nameOf(ctx, p.child_id))}`;
    }
    case "add_partner": {
      const st = PARTNER_STATUS_LABELS[str(p.status) as keyof typeof PARTNER_STATUS_LABELS] ?? PARTNER_STATUS_LABELS.married;
      return `${q(nameOf(ctx, p.a_id))} và ${q(nameOf(ctx, p.b_id))} là vợ/chồng (${st.toLowerCase()})`;
    }
    case "remove_link": {
      const link = typeof p.link_id === "string" ? ctx.links.get(p.link_id) : undefined;
      if (link) return `Gỡ quan hệ cha/mẹ - con: ${q(nameOf(ctx, link.parent))} (cha/mẹ) và ${q(nameOf(ctx, link.child))} (con)`;
      const pt = typeof p.partnership_id === "string" ? ctx.partnerships.get(p.partnership_id) : undefined;
      if (pt) return `Gỡ quan hệ vợ/chồng: ${q(nameOf(ctx, pt.a))} và ${q(nameOf(ctx, pt.b))}`;
      return "Gỡ một quan hệ (quan hệ này không còn hoặc bạn không xem được)";
    }
    default: return REQUEST_KIND_LABELS[r.kind as keyof typeof REQUEST_KIND_LABELS] ?? "Yêu cầu";
  }
}

/** Mọi mã cần tra tên/quan hệ để hiển thị các yêu cầu. */
export function referencedIds(rows: Pick<ChangeRequestRow, "target_member_id" | "payload">[]) {
  const members = new Set<string>(), links = new Set<string>(), partnerships = new Set<string>();
  const uuid = /^[0-9a-f-]{36}$/i;
  for (const r of rows) {
    if (r.target_member_id) members.add(r.target_member_id);
    const p = (r.payload ?? {}) as Record<string, unknown>;
    for (const k of ["child_id", "parent_id", "a_id", "b_id"]) if (typeof p[k] === "string" && uuid.test(p[k] as string)) members.add(p[k] as string);
    if (typeof p.link_id === "string" && uuid.test(p.link_id)) links.add(p.link_id);
    if (typeof p.partnership_id === "string" && uuid.test(p.partnership_id)) partnerships.add(p.partnership_id);
  }
  return { members, links, partnerships };
}
