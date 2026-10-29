import type { MetadataRoute } from "next";

// Web riêng tư của gia đình: cấm mọi bot lập chỉ mục (khớp metadata robots ở layout).
// File này cũng giúp /robots.txt trả về nội dung thật thay vì bị chặn đăng nhập.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
