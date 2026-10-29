import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Các đường dẫn công khai (không cần đăng nhập). Mọi đường dẫn khác bị chặn.
// /api/cron/ không có phiên người dùng: từng route tự xác thực bằng Bearer CRON_SECRET (so sánh thời gian hằng) và từ chối khi thiếu bí mật.
const PUBLIC_PREFIXES = ["/dang-nhap", "/quen-mat-khau", "/dat-lai-mat-khau", "/moi/", "/manifest.webmanifest", "/icon", "/icons/", "/voice/", "/sw.js", "/offline", "/robots.txt", "/api/cron/"];

// Cookie phiên của @supabase/ssr: sb-<project-ref>-auth-token (có thể chia nhỏ thành .0, .1...).
// Không có cookie này thì chắc chắn chưa đăng nhập — khỏi cần hỏi máy chủ Supabase.
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}

/**
 * Lớp chặn thô ở biên: làm mới phiên Supabase và đẩy người chưa đăng nhập về /dang-nhap.
 * KHÔNG phải lớp bảo mật duy nhất: mỗi trang/Server Action kiểm tra lại quyền (src/lib/auth.ts)
 * và dữ liệu luôn chịu RLS ở cơ sở dữ liệu.
 *
 * Tối ưu tốc độ (đo thực tế 29/10/2026: mỗi vòng mạng qua Supabase tốn 0,2–0,9 giây):
 * 1. Đường công khai đi thẳng, không tạo client Supabase, không kiểm tra phiên.
 * 2. Không có cookie đăng nhập + đường riêng tư => chuyển hướng ngay, không gọi Supabase.
 *    Trước đây MỌI yêu cầu (kể cả /robots.txt và khách chưa đăng nhập) đều phải chờ
 *    một vòng mạng sang Supabase rồi mới được chuyển hướng.
 * 3. Đã đăng nhập mà vào /dang-nhap => đưa về "/" ngay tại đây; nhờ vậy trang đăng nhập
 *    không cần kiểm tra phiên ở máy chủ nữa và trở thành trang tĩnh (CDN trả ngay).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublic && pathname !== "/dang-nhap") {
    return NextResponse.next({ request });
  }

  if (!hasAuthCookie(request)) {
    if (isPublic) return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = "/dang-nhap";
    url.search = "";
    return NextResponse.redirect(url);
  }

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

  if (data?.claims && pathname === "/dang-nhap") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/dang-nhap";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|webmanifest)$).*)"],
};
