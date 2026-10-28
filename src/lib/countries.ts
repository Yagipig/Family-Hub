/**
 * Bảng tra quốc gia → múi giờ IANA gợi ý. Múi giờ đầu tiên là mặc định (thủ đô / nơi đông dân nhất).
 * Người dùng vẫn có thể chọn tay bất kỳ múi giờ hợp lệ nào khác (xem trang /cai-dat/vi-tri).
 * Mã quốc gia theo ISO 3166-1 alpha-2 (khớp user_profiles.country_code).
 */
export type Country = { code: string; name: string; zones: readonly string[] };

export const COUNTRIES: readonly Country[] = [
  { code: "VN", name: "Việt Nam", zones: ["Asia/Ho_Chi_Minh"] },
  { code: "JP", name: "Nhật Bản", zones: ["Asia/Tokyo"] },
  { code: "KR", name: "Hàn Quốc", zones: ["Asia/Seoul"] },
  { code: "TW", name: "Đài Loan", zones: ["Asia/Taipei"] },
  { code: "SG", name: "Singapore", zones: ["Asia/Singapore"] },
  { code: "TH", name: "Thái Lan", zones: ["Asia/Bangkok"] },
  { code: "MY", name: "Malaysia", zones: ["Asia/Kuala_Lumpur"] },
  { code: "CN", name: "Trung Quốc", zones: ["Asia/Shanghai"] },
  { code: "HK", name: "Hồng Kông", zones: ["Asia/Hong_Kong"] },
  { code: "MO", name: "Ma Cao", zones: ["Asia/Macau"] },
  { code: "PH", name: "Philippines", zones: ["Asia/Manila"] },
  { code: "ID", name: "Indonesia", zones: ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"] },
  { code: "KH", name: "Campuchia", zones: ["Asia/Phnom_Penh"] },
  { code: "LA", name: "Lào", zones: ["Asia/Vientiane"] },
  { code: "MM", name: "Myanmar", zones: ["Asia/Yangon"] },
  { code: "IN", name: "Ấn Độ", zones: ["Asia/Kolkata"] },
  { code: "AE", name: "Các Tiểu vương quốc Ả Rập Thống nhất", zones: ["Asia/Dubai"] },
  { code: "QA", name: "Qatar", zones: ["Asia/Qatar"] },
  { code: "SA", name: "Ả Rập Xê Út", zones: ["Asia/Riyadh"] },
  { code: "IL", name: "Israel", zones: ["Asia/Jerusalem"] },
  { code: "TR", name: "Thổ Nhĩ Kỳ", zones: ["Europe/Istanbul"] },
  { code: "AU", name: "Úc", zones: ["Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Adelaide", "Australia/Darwin", "Australia/Perth", "Australia/Hobart"] },
  { code: "NZ", name: "New Zealand", zones: ["Pacific/Auckland", "Pacific/Chatham"] },
  { code: "US", name: "Hoa Kỳ", zones: ["America/Los_Angeles", "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu"] },
  { code: "CA", name: "Canada", zones: ["America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg", "America/Halifax", "America/St_Johns"] },
  { code: "MX", name: "Mexico", zones: ["America/Mexico_City", "America/Tijuana", "America/Cancun"] },
  { code: "BR", name: "Brazil", zones: ["America/Sao_Paulo", "America/Manaus", "America/Fortaleza"] },
  { code: "GB", name: "Vương quốc Anh", zones: ["Europe/London"] },
  { code: "IE", name: "Ireland", zones: ["Europe/Dublin"] },
  { code: "FR", name: "Pháp", zones: ["Europe/Paris"] },
  { code: "DE", name: "Đức", zones: ["Europe/Berlin"] },
  { code: "CH", name: "Thụy Sĩ", zones: ["Europe/Zurich"] },
  { code: "AT", name: "Áo", zones: ["Europe/Vienna"] },
  { code: "NL", name: "Hà Lan", zones: ["Europe/Amsterdam"] },
  { code: "BE", name: "Bỉ", zones: ["Europe/Brussels"] },
  { code: "IT", name: "Ý", zones: ["Europe/Rome"] },
  { code: "ES", name: "Tây Ban Nha", zones: ["Europe/Madrid", "Atlantic/Canary"] },
  { code: "PT", name: "Bồ Đào Nha", zones: ["Europe/Lisbon", "Atlantic/Azores"] },
  { code: "NO", name: "Na Uy", zones: ["Europe/Oslo"] },
  { code: "SE", name: "Thụy Điển", zones: ["Europe/Stockholm"] },
  { code: "DK", name: "Đan Mạch", zones: ["Europe/Copenhagen"] },
  { code: "FI", name: "Phần Lan", zones: ["Europe/Helsinki"] },
  { code: "PL", name: "Ba Lan", zones: ["Europe/Warsaw"] },
  { code: "CZ", name: "Cộng hòa Séc", zones: ["Europe/Prague"] },
  { code: "HU", name: "Hungary", zones: ["Europe/Budapest"] },
  { code: "RO", name: "Romania", zones: ["Europe/Bucharest"] },
  { code: "UA", name: "Ukraina", zones: ["Europe/Kyiv"] },
  { code: "RU", name: "Nga", zones: ["Europe/Moscow", "Asia/Yekaterinburg", "Asia/Novosibirsk", "Asia/Krasnoyarsk", "Asia/Irkutsk", "Asia/Yakutsk", "Asia/Vladivostok", "Asia/Kamchatka", "Europe/Kaliningrad"] },
  { code: "ZA", name: "Nam Phi", zones: ["Africa/Johannesburg"] },
  { code: "EG", name: "Ai Cập", zones: ["Africa/Cairo"] },
  { code: "NG", name: "Nigeria", zones: ["Africa/Lagos"] },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function findCountry(code: string | null | undefined): Country | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined;
}

export function countryName(code: string | null | undefined): string {
  return findCountry(code)?.name ?? "Khác";
}

/** Múi giờ mặc định gợi ý cho quốc gia (null nếu không có trong bảng). */
export function defaultZoneFor(code: string | null | undefined): string | null {
  return findCountry(code)?.zones[0] ?? null;
}

/** Quốc gia gợi ý cho một múi giờ (để hiển thị "Bây giờ ở Nhật Bản…" khi chỉ biết múi giờ). */
export function countryForZone(tz: string): Country | undefined {
  return COUNTRIES.find((c) => c.zones.includes(tz));
}

/**
 * Toàn bộ múi giờ IANA mà runtime hỗ trợ (dùng cho lựa chọn "múi giờ khác"), gộp với các tên trong bảng quốc gia
 * (Intl trả về tên chuẩn hoá, ví dụ Asia/Saigon, còn bảng này dùng tên thông dụng Asia/Ho_Chi_Minh).
 */
export function allZones(): string[] {
  const set = new Set(COUNTRIES.flatMap((c) => c.zones));
  set.add("UTC");
  try {
    const f = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (f) for (const z of f("timeZone")) set.add(z);
  } catch {
    /* chỉ dùng bảng quốc gia */
  }
  return [...set].sort();
}
