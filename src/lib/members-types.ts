// Kiểu dữ liệu dùng chung cho module Thành viên và Gia phả (không phụ thuộc máy chủ để dùng được ở client và trong test).

export type Gender = "male" | "female" | "other";
export type Visibility = "family" | "branch" | "admins";
export type ParentKind = "biological" | "adoptive" | "step";
export type PartnerStatus = "married" | "divorced" | "widowed" | "partner";
export type BirthdayMode = "solar" | "lunar" | "both";
export type RequestKind = "update_member" | "create_member" | "delete_member" | "add_parent" | "add_partner" | "remove_link";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

/** Một dòng của view public.members_view (trường bị che là null). */
export type MemberRow = {
  id: string;
  family_id: string;
  branch_id: string | null;
  full_name: string;
  nickname: string | null;
  alt_names: string | null;
  gender: Gender | null;
  avatar_path: string | null;
  birth_solar_year: number | null;
  birth_solar_month: number | null;
  birth_solar_day: number | null;
  birth_lunar_year: number | null;
  birth_lunar_month: number | null;
  birth_lunar_day: number | null;
  birth_lunar_leap: boolean;
  birthday_mode: BirthdayMode;
  is_deceased: boolean;
  death_solar_year: number | null;
  death_solar_month: number | null;
  death_solar_day: number | null;
  death_lunar_month: number | null;
  death_lunar_day: number | null;
  death_lunar_leap: boolean;
  hometown: string | null;
  generation_title: string | null;
  generation_no: number | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  birth_visibility: Visibility | null;
  death_visibility: Visibility | null;
  contact_visibility: Visibility | null;
  photo_visibility: Visibility | null;
  is_minor: boolean;
  is_self: boolean;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
};

/** Kết quả member_field_access: nhóm trường nào người dùng hiện tại được xem. */
export type FieldAccess = { birth: boolean; death: boolean; contact: boolean; photo: boolean };

export type ParentLinkRow = { id: string; child_id: string; parent_id: string; kind: ParentKind };
export type PartnershipRow = {
  id: string; member_a: string; member_b: string; status: PartnerStatus; start_year: number | null; end_year: number | null;
};
export type BranchRow = { id: string; name: string; parent_branch_id: string | null };

/** Thông tin tối thiểu một người trên cây / trong bộ chọn. */
export type TreePerson = {
  id: string;
  name: string;
  nick: string | null;
  gender: Gender | null;
  branchId: string | null;
  /** năm sinh dương */
  by: number | null;
  /** năm mất dương (có thể null do bị che hoặc chưa rõ) */
  dy: number | null;
  dead: boolean;
  /** URL ảnh đã ký (do module media cấp); null = dùng chữ cái đầu */
  avatar: string | null;
  /** số đời nhập tay (generation_no), có thể null */
  gen: number | null;
};

export type TreeLink = { id: string; child: string; parent: string; kind: ParentKind };
export type TreePartner = { id: string; a: string; b: string; status: PartnerStatus; start: number | null; end: number | null };

export type PickerMember = { id: string; name: string; nick: string | null; alt: string | null; by: number | null; branch: string | null };

export type ChangeRequestRow = {
  id: string;
  family_id: string;
  requested_by: string;
  kind: RequestKind;
  target_member_id: string | null;
  branch_id: string | null;
  payload: Record<string, unknown>;
  note: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};
