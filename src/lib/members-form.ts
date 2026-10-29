// Giá trị ban đầu của biểu mẫu thành viên (chuỗi, để dùng cho ô nhập kiểm soát) — thuần, dùng được ở client.
import type { MemberRow } from "./members-types";

export type FormValues = {
  full_name: string; nickname: string; alt_names: string; gender: string; branch_id: string;
  hometown: string; generation_title: string; generation_no: string; bio: string;
  birth_solar_year: string; birth_solar_month: string; birth_solar_day: string;
  birth_lunar_year: string; birth_lunar_month: string; birth_lunar_day: string; birth_lunar_leap: boolean; birthday_mode: string;
  is_deceased: boolean;
  death_solar_year: string; death_solar_month: string; death_solar_day: string;
  death_lunar_month: string; death_lunar_day: string; death_lunar_leap: boolean;
  phone: string; email: string;
  birth_visibility: string; death_visibility: string; contact_visibility: string; photo_visibility: string;
};

export function emptyValues(over: Partial<FormValues> = {}): FormValues {
  return {
    full_name: "", nickname: "", alt_names: "", gender: "", branch_id: "",
    hometown: "", generation_title: "", generation_no: "", bio: "",
    birth_solar_year: "", birth_solar_month: "", birth_solar_day: "",
    birth_lunar_year: "", birth_lunar_month: "", birth_lunar_day: "", birth_lunar_leap: false, birthday_mode: "solar",
    is_deceased: false,
    death_solar_year: "", death_solar_month: "", death_solar_day: "",
    death_lunar_month: "", death_lunar_day: "", death_lunar_leap: false,
    phone: "", email: "",
    birth_visibility: "family", death_visibility: "family", contact_visibility: "branch", photo_visibility: "family",
    ...over,
  };
}

const s = (v: string | number | null | undefined) => (v == null ? "" : String(v));

export function valuesFromRow(m: MemberRow): FormValues {
  return emptyValues({
    full_name: m.full_name, nickname: s(m.nickname), alt_names: s(m.alt_names), gender: s(m.gender), branch_id: s(m.branch_id),
    hometown: s(m.hometown), generation_title: s(m.generation_title), generation_no: s(m.generation_no), bio: s(m.bio),
    birth_solar_year: s(m.birth_solar_year), birth_solar_month: s(m.birth_solar_month), birth_solar_day: s(m.birth_solar_day),
    birth_lunar_year: s(m.birth_lunar_year), birth_lunar_month: s(m.birth_lunar_month), birth_lunar_day: s(m.birth_lunar_day),
    birth_lunar_leap: m.birth_lunar_leap, birthday_mode: m.birthday_mode,
    is_deceased: m.is_deceased,
    death_solar_year: s(m.death_solar_year), death_solar_month: s(m.death_solar_month), death_solar_day: s(m.death_solar_day),
    death_lunar_month: s(m.death_lunar_month), death_lunar_day: s(m.death_lunar_day), death_lunar_leap: m.death_lunar_leap,
    phone: s(m.phone), email: s(m.email),
    birth_visibility: s(m.birth_visibility) || "family", death_visibility: s(m.death_visibility) || "family",
    contact_visibility: s(m.contact_visibility) || "branch", photo_visibility: s(m.photo_visibility) || "family",
  });
}
