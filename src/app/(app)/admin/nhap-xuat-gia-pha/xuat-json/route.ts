import { can } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { memberError } from "@/lib/members-errors";
import { gateAdmin, see } from "@/lib/members-route";
import { sameOrigin } from "@/lib/members-schemas";

const PAGE = "/admin/nhap-xuat-gia-pha";

/** Xuất toàn bộ gia phả ra JSON. Quyền 'tree','export' do RPC kiểm tra và RPC tự ghi nhật ký. */
export async function POST(request: Request) {
  if (!sameOrigin(request.headers.get("origin"), request.headers.get("x-forwarded-host") ?? request.headers.get("host"))) return new Response("Forbidden", { status: 403 });
  const gate = await gateAdmin(PAGE);
  if ("response" in gate) return gate.response;
  const { session } = gate;
  if (!(await can(session, "tree", "export"))) return see(PAGE, "error", "Bạn không có quyền xuất gia phả.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_family_tree", { p_family: session.familyId });
  if (error || !data) return see(PAGE, "error", error ? memberError(error) : "Không xuất được dữ liệu.");

  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gia-pha-${day}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
