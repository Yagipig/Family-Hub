"use server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { backTo, rpcMessage } from "@/lib/games/server";
import { isValidLotoCard } from "@/lib/games/loto";
import { z } from "zod";

const BASE = "/admin/tro-choi/bang-lo-to";
const codeSchema = z.string().regex(/^VN63-\d{3}$/, "Mã bảng chưa đúng");
const gridSchema = z.array(z.number().int().min(0).max(90)).length(27);

/** Sinh bo so moi hop le o may chu cho nut "Dao bo so moi" (tra JSON de xem truoc, chua luu). */
export async function boardRandomGrid(): Promise<{ ok: true; grid: number[] } | { ok: false; error: string }> {
  const session = await requireAdmin(BASE);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("loto_board_random", { p_family: session.familyId });
  if (error) return { ok: false, error: rpcMessage(error) };
  return { ok: true, grid: (data as number[]).map(Number) };
}

/** Luu bang (may chu kiem tra lai tinh hop le + ghi lich su). */
export async function boardUpdate(fd: FormData) {
  const session = await requireAdmin(BASE);
  const code = codeSchema.safeParse(String(fd.get("code") ?? ""));
  if (!code.success) return backTo(BASE, "error", "Mã bảng chưa đúng.");
  let grid: unknown = null;
  try { grid = JSON.parse(String(fd.get("grid") ?? "")); } catch { grid = null; }
  const parsed = gridSchema.safeParse(grid);
  if (!parsed.success || !isValidLotoCard(parsed.data)) {
    return backTo(`${BASE}?code=${code.data}`, "error", "Bảng chưa hợp lệ: mỗi hàng phải có đúng 5 số, số thuộc đúng dải cột và tăng dần trong cột.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("loto_board_update", {
    p_family: session.familyId, p_code: code.data, p_grid: parsed.data,
  });
  if (error) return backTo(`${BASE}?code=${code.data}`, "error", rpcMessage(error));
  return backTo(`${BASE}?code=${code.data}`, "ok", `Đã lưu bảng ${code.data}. Thay đổi áp dụng cho các ván sau; bảng người chơi đã chọn không đổi.`);
}

/** Khoi phuc ban truoc trong lich su (doi cho qua lai duoc). */
export async function boardRestore(fd: FormData) {
  const session = await requireAdmin(BASE);
  const code = codeSchema.safeParse(String(fd.get("code") ?? ""));
  if (!code.success) return backTo(BASE, "error", "Mã bảng chưa đúng.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("loto_board_restore", { p_family: session.familyId, p_code: code.data });
  if (error) return backTo(`${BASE}?code=${code.data}`, "error", rpcMessage(error));
  return backTo(`${BASE}?code=${code.data}`, "ok", `Đã khôi phục bảng ${code.data} về bản trước trong lịch sử.`);
}
