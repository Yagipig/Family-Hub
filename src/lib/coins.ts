/**
 * Loại "xu" hiển thị thay cho điểm trong trò chơi (Mục 1 — yêu cầu của chủ nhà 29/10/2026).
 * Điểm trong CSDL vẫn là số nguyên như cũ; "xu" chỉ là TÊN GỌI + biểu tượng mà quản trị
 * chọn cho cả gia đình (game_settings.coin_unit). Đổi loại xu không đổi số dư của ai.
 */

export type CoinUnit = { key: string; name: string; icon: string };

/** Danh mục xu quản trị được chọn. "diem" là mặc định — giữ nguyên cách hiển thị cũ. */
export const COIN_UNITS: readonly CoinUnit[] = [
  { key: "diem", name: "Điểm", icon: "" },
  { key: "heo-vang", name: "Heo Vàng", icon: "🐷" },
  { key: "la", name: "Lá", icon: "🍃" },
  { key: "cu", name: "Củ", icon: "🥔" },
  { key: "sao", name: "Sao", icon: "⭐" },
  { key: "hoa-dao", name: "Hoa Đào", icon: "🌸" },
  { key: "hat-de", name: "Hạt Dẻ", icon: "🌰" },
  { key: "keo", name: "Kẹo", icon: "🍬" },
  { key: "xu-bac", name: "Xu Bạc", icon: "🪙" },
  { key: "ca-chep", name: "Cá Chép", icon: "🐟" },
  { key: "trang", name: "Trăng", icon: "🌙" },
] as const;

export const CUSTOM_COIN_KEY = "custom";

/** Biểu tượng quản trị được chọn khi tự đặt tên xu. */
export const CUSTOM_COIN_ICONS: readonly string[] = [
  "🐷", "🍃", "🥔", "⭐", "🌸", "🌰", "🍬", "🪙", "🐟", "🌙", "🎁", "💎", "🔥", "🍀", "🦋", "🐣",
] as const;

export type CoinSettingsLike = {
  coin_unit?: string | null;
  coin_custom_name?: string | null;
  coin_custom_icon?: string | null;
} | null | undefined;

export function isCoinUnitKey(key: string): boolean {
  return key === CUSTOM_COIN_KEY || COIN_UNITS.some((u) => u.key === key);
}

/** Suy ra loại xu đang hiệu lực từ cài đặt gia đình. Thiếu dữ liệu → Điểm (như cũ). */
export function resolveCoin(settings: CoinSettingsLike): CoinUnit {
  const key = settings?.coin_unit ?? "diem";
  if (key === CUSTOM_COIN_KEY) {
    const name = (settings?.coin_custom_name ?? "").trim() || "Xu";
    const icon = CUSTOM_COIN_ICONS.includes(settings?.coin_custom_icon ?? "")
      ? (settings?.coin_custom_icon as string)
      : "🪙";
    return { key: CUSTOM_COIN_KEY, name, icon };
  }
  return COIN_UNITS.find((u) => u.key === key) ?? COIN_UNITS[0];
}

/** "1.250 Heo Vàng" — số giữ nguyên giá trị, chỉ thay tên đơn vị. */
export function formatCoinAmount(amount: number, coin: CoinUnit): string {
  return `${amount.toLocaleString("vi-VN")} ${coin.name}`;
}

/** "🐷 Heo Vàng" — nhãn ngắn có biểu tượng (để trống biểu tượng nếu là Điểm mặc định). */
export function coinLabel(coin: CoinUnit): string {
  return coin.icon ? `${coin.icon} ${coin.name}` : coin.name;
}
