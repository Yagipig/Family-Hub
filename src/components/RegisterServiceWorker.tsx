"use client";
import { useEffect } from "react";

/** Đăng ký service worker tối giản (chỉ trang ngoại tuyến + tài nguyên tĩnh). Lỗi đăng ký không ảnh hưởng ứng dụng. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
