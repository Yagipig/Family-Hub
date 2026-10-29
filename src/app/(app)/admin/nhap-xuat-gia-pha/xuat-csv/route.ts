import { can } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvLunarDate, csvSolarDate, toCsv } from "@/lib/csv";
import { memberError } from "@/lib/members-errors";
import { fetchAll, loadBranches } from "@/lib/members-data";
import { gateAdmin, see } from "@/lib/members-route";
import { sameOrigin } from "@/lib/members-schemas";
import { BIRTHDAY_MODE_LABELS, GENDER_LABELS } from "@/lib/members-text";
import type { MemberRow } from "@/lib/members-types";

const PAGE = "/admin/nhap-xuat-gia-pha";

/** Xuất danh sách thành viên ra CSV: CHỈ những trường mà chính người xuất được thấy (đọc từ members_view). */
export async function POST(request: Request) {
  if (!sameOrigin(request.headers.get("origin"), request.headers.get("x-forwarded-host") ?? request.headers.get("host"))) return new Response("Forbidden", { status: 403 });
  const gate = await gateAdmin(PAGE);
  if ("response" in gate) return gate.response;
  const { session } = gate;
  if (!(await can(session, "members", "export"))) return see(PAGE, "error", "Bạn không có quyền xuất danh sách thành viên.");

  const supabase = await createClient();
  const [rows, branches] = await Promise.all([
    fetchAll<MemberRow>((a, b) => supabase.from("members_view").select("*").order("full_name").order("id").range(a, b)),
    loadBranches(supabase),
  ]);
  // Ghi nhật ký TRƯỚC khi trả dữ liệu: nếu không ghi được thì không xuất
  const { error } = await supabase.rpc("log_members_export", { p_family: session.familyId, p_rows: rows.length });
  if (error) return see(PAGE, "error", memberError(error));

  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const header = ["Họ và tên", "Tên thường gọi", "Tên gọi khác", "Giới tính", "Nhánh", "Đời", "Tên đời / bối", "Ngày sinh (dương)", "Ngày sinh (âm)",
    "Nhắc sinh nhật theo", "Tình trạng", "Ngày mất (dương)", "Ngày mất (âm)", "Quê quán", "Điện thoại", "Email"];
  const body = rows.map((m) => [
    m.full_name, m.nickname, m.alt_names, m.gender ? GENDER_LABELS[m.gender] : "", m.branch_id ? (branchName.get(m.branch_id) ?? "") : "",
    m.generation_no, m.generation_title,
    csvSolarDate(m.birth_solar_year, m.birth_solar_month, m.birth_solar_day),
    csvLunarDate(m.birth_lunar_year, m.birth_lunar_month, m.birth_lunar_day, m.birth_lunar_leap),
    BIRTHDAY_MODE_LABELS[m.birthday_mode], m.is_deceased ? "Đã mất" : "Còn sống",
    csvSolarDate(m.death_solar_year, m.death_solar_month, m.death_solar_day),
    csvLunarDate(null, m.death_lunar_month, m.death_lunar_day, m.death_lunar_leap),
    m.hometown, m.phone, m.email,
  ]);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(header, body), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="thanh-vien-${day}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
