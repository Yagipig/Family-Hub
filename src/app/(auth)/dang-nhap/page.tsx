import { LoginForm } from "./LoginForm";

export const metadata = { title: "Đăng nhập" };

// Trang này cố ý KHÔNG kiểm tra phiên ở máy chủ: proxy.ts đã đưa người
// đã đăng nhập về "/" và chặn người chưa đăng nhập khỏi mọi trang riêng tư.
// Nhờ vậy trang đăng nhập là trang TĨNH, Vercel CDN trả ngay lập tức thay vì
// mỗi lần mở phải chờ một vòng mạng sang Supabase như trước.
export default function LoginPage() {
  return <LoginForm />;
}
