import "server-only";
import { ADMIN_ROLES, getSession, type Session } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Phản hồi chuyển hướng 303 (sau POST phải là 303 để trình duyệt chuyển sang GET). */
export function see(path: string, kind?: "ok" | "error", msg?: string): Response {
  const loc = kind && msg ? `${path}?${kind}=${encodeURIComponent(msg)}` : path;
  return new Response(null, { status: 303, headers: { Location: loc } });
}

/**
 * Cổng quản trị cho route handler (POST): giống requireAdmin nhưng trả về phản hồi 303 thay vì ném chuyển hướng 307
 * (307 sẽ gửi lại POST tới trang đích và bị từ chối).
 */
export async function gateAdmin(next: string): Promise<{ session: Session } | { response: Response }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { response: see("/dang-nhap") };
  const session = await getSession();
  if (!session) return { response: see("/khong-co-quyen") };
  if (!ADMIN_ROLES.includes(session.role)) return { response: see("/") };
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    return { response: aal?.nextLevel === "aal2" ? see(`/mfa?next=${encodeURIComponent(next)}`) : see("/cai-dat/bao-mat?required=1") };
  }
  return { session };
}
