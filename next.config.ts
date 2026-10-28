import type { NextConfig } from "next";

// Nguồn Supabase (REST, Storage ảnh đã ký, Realtime websocket) lấy từ biến môi trường để CSP chỉ mở đúng một máy chủ.
function supabaseOrigins(): { http: string; ws: string } {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return { http: u.origin, ws: `${u.protocol === "https:" ? "wss" : "ws"}://${u.host}` };
  } catch {
    return { http: "", ws: "" };
  }
}
const sb = supabaseOrigins();
// Next.js (không nonce) cần 'unsafe-inline' cho script/style khởi tạo; các hạn chế còn lại vẫn chặn nhúng, form ra ngoài, plugin, kết nối lạ.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"),
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${sb.http}`.trim(),
  `connect-src 'self' ${sb.http} ${sb.ws}`.trim(),
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Service worker luôn được kiểm tra lại để cập nhật nhanh; không cho phép mở rộng phạm vi
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default nextConfig;
