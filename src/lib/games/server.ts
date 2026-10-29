import "server-only";
import { redirect } from "next/navigation";
import { can, type Session } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/format";
import { gamesError } from "./errors";

export type GameSettings = {
  enabled: boolean;
  leaderboard_enabled: boolean;
  starting_points: number;
  daily_gift: number;
  bc_min_bet: number;
  bc_max_bet: number;
  bc_max_round_total: number;
  bc_daily_loss_cap: number;
  bc_daily_win_cap: number;
  loto_false_penalty?: number;
  /** Cau hinh am thanh lo to dot 2 (migration 20261104000006); thieu -> mac dinh. */
  loto_music_url?: string | null;
  loto_chatter?: number;
  loto_extra_lines?: string[];
  /** Loại xu hiển thị thay cho "điểm" (cột có từ migration 20261104000002; thiếu → mặc định Điểm). */
  coin_unit?: string | null;
  coin_custom_name?: string | null;
  coin_custom_icon?: string | null;
};

export type GamesAccess =
  | { state: "no_access"; isAdmin: false; settings: null }
  | { state: "off"; isAdmin: boolean; settings: GameSettings | null }
  | { state: "ok"; isAdmin: boolean; settings: GameSettings };

/**
 * Trang thai truy cap module tro choi cho nguoi dung hien tai.
 * Quyen that su do CSDL quyet dinh (RPC/RLS); day chi de chon man hinh hien thi.
 *  - no_access: khong co quyen games.view (vi du tai khoan khach)
 *  - off: quan tri chua bat module cho gia dinh
 */
export async function gamesAccess(session: Session): Promise<GamesAccess> {
  const [canPlay, isAdmin] = await Promise.all([can(session, "games", "view"), can(session, "games", "update")]);
  if (!canPlay) return { state: "no_access", isAdmin: false, settings: null };
  const supabase = await createClient();
  const { data } = await supabase.from("game_settings").select("*").eq("family_id", session.familyId).maybeSingle();
  const settings = (data as GameSettings | null) ?? null;
  if (!settings?.enabled) return { state: "off", isAdmin, settings };
  return { state: "ok", isAdmin, settings };
}

/** Ten hien thi cua cac tai khoan (RLS cho phep xem ho so trong cung gia dinh). */
export async function profileNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniq = [...new Set(ids)].filter(Boolean);
  if (!uniq.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.from("user_profiles").select("id, display_name, alias_name").in("id", uniq);
  for (const r of (data ?? []) as Array<{ id: string; display_name: string; alias_name: string | null }>) map.set(r.id, r.alias_name?.trim() ? r.alias_name : r.display_name);
  return map;
}

/** Quay lai trang voi thong bao (khong dat trong try/catch vi redirect nem ngoai le dac biet). */
export function backTo(base: string, kind: "ok" | "error", msg: string): never {
  redirect(`${base}${base.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);
}

export function rpcMessage(error: { code?: string; message?: string }): string {
  return gamesError(error) ?? friendlyError(error);
}

export const REASON_LABELS: Record<string, string> = {
  start: "Khởi đầu",
  daily_gift: "Quà hằng ngày",
  lixi: "Lì xì may mắn",
  lottery_ticket: "Mua vé xổ số",
  lottery_refund: "Hoàn vé xổ số",
  lottery_prize: "Trúng giải xổ số",
  loto_prize: "Thắng lô tô",
  baucua_bet: "Đặt cược bầu cua",
  baucua_payout: "Nhận thưởng bầu cua",
  baucua_refund: "Hoàn cược bầu cua",
};

export { NOTICE } from "./notice";
