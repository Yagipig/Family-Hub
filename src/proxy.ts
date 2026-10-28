import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Các đường dẫn công khai (không cần đăng nhập). Mọi đường dẫn khác bị chặn.
// /api/cron/ không có phiên người dùng: từng route tự xác thực bằng Bearer CRON_SECRET (so sánh thời gian hằng) và từ chối khi thiếu bí mật.
const PUBLIC_PREFIXES = ["/dang-nhap", "/moi/", "/manifest.webmanifest", "/icon", "/icons/", "/sw.js", "/offline", "/api/cron/"];

/**
 * Lớp chặn thô ở biên: làm mới phiên Supabase và đẩy người chưa đăng nhập về /dang-nhap.
 * KHÔNG phải lớp bảo mật duy nhất: mỗi trang/Server Action kiểm tra lại quyền (src/lib/auth.ts)
 * và dữ liệu luôn chịu RLS ở cơ sở dữ liệu.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isPublic = PUBLIC_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/dang-nhap";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
