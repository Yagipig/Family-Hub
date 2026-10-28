import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Tải dữ liệu cá nhân của CHÍNH người đăng nhập. Mọi truy vấn chạy bằng quyền người dùng (RLS) nên không thể lấy dữ liệu người khác. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const supabase = await createClient();
  const uid = session.userId;
  const [profile, member, prefs, changes, requests, notifs] = await Promise.all([
    supabase.from("user_profiles").select("display_name, locale, country_code, timezone, created_at").eq("id", uid).maybeSingle(),
    supabase.from("members_view").select("*").eq("family_id", session.familyId).eq("is_self", true).maybeSingle(),
    supabase.from("notification_preferences").select("*").eq("user_id", uid),
    supabase.from("member_change_requests").select("id, kind, status, payload, note, created_at, reviewed_at, review_note").eq("requested_by", uid).limit(500),
    supabase.from("data_requests").select("id, kind, note, status, handler_note, created_at, handled_at").eq("user_id", uid).limit(500),
    supabase.from("notifications").select("kind, title, body, link, created_at, read_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(500),
  ]);
  await supabase.rpc("log_my_data_export", { p_family: session.familyId });
  const body = {
    exported_at: new Date().toISOString(),
    account: { email: session.email, role: session.role },
    profile: profile.data, member: member.data, notification_preferences: prefs.data,
    change_requests: changes.data, data_requests: requests.data, notifications: notifs.data,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="du-lieu-cua-toi.json"',
      "Cache-Control": "no-store",
    },
  });
}
