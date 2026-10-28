import { can } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { memberError } from "@/lib/members-errors";
import { gateAdmin, see } from "@/lib/members-route";
import { IMPORT_MAX_BYTES, parseImportText, sameOrigin } from "@/lib/members-schemas";

const PAGE = "/admin/nhap-xuat-gia-pha";
export const maxDuration = 60;

/**
 * Nhập gia phả từ JSON. Dùng route handler (không phải Server Action) vì Server Action mặc định giới hạn 1 MB.
 * Mọi thứ được kiểm tra bằng zod trước khi gọi RPC; RPC chạy trong một giao dịch nên lỗi giữa chừng không để lại dữ liệu dở dang.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request.headers.get("origin"), request.headers.get("x-forwarded-host") ?? request.headers.get("host"))) return new Response("Forbidden", { status: 403 });
  const gate = await gateAdmin(PAGE);
  if ("response" in gate) return gate.response;
  const { session } = gate;
  if (!(await can(session, "tree", "update"))) return see(PAGE, "error", "Chỉ quản trị gia đình mới được nhập gia phả.");

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > IMPORT_MAX_BYTES + 64 * 1024) return see(PAGE, "error", "Tệp quá lớn (tối đa 5 MB).");

  let form: FormData;
  try { form = await request.formData(); } catch { return see(PAGE, "error", "Không đọc được tệp tải lên."); }
  if (form.get("confirm") !== "on") return see(PAGE, "error", "Hãy tích vào ô xác nhận đã hiểu việc nhập sẽ thêm mới thành viên.");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return see(PAGE, "error", "Hãy chọn một tệp .json để nhập.");
  if (file.size > IMPORT_MAX_BYTES) return see(PAGE, "error", "Tệp quá lớn (tối đa 5 MB).");

  const parsed = parseImportText(await file.text());
  if (!parsed.ok) return see(PAGE, "error", parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_family_tree", { p_family: session.familyId, p_data: parsed.data });
  if (error) return see(PAGE, "error", `${memberError(error)} Không có dữ liệu nào được nhập.`);
  const r = (data ?? {}) as { members?: number; parents?: number; partners?: number };
  return see(PAGE, "ok",
    `Đã nhập ${r.members ?? 0} thành viên, ${r.parents ?? 0} quan hệ cha mẹ - con, ${r.partners ?? 0} quan hệ vợ chồng.`);
}
