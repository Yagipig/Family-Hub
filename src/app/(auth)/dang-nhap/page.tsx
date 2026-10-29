import { LoginForm } from "./LoginForm";

export const metadata = { title: "Đăng nhập" };

// Trang này cố ý KHÔNG kiểm tra phiên ở máy chủ: proxy.ts đã đưa người
// đã đăng nhập về "/" và chặn người chưa đăng nhập khỏi mọi trang riêng tư.
// Nhờ vậy trang đăng nhập là trang TĨNH, Vercel CDN trả ngay lập tức thay vì
// mỗi lần mở phải chờ một vòng mạng sang Supabase như trước.
export default function LoginPage() {
  return (
    <>
      <section className="space-y-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/family-tree-hero.jpg"
          alt="Cây gia phả minh họa các thế hệ trong gia đình"
          className="w-full rounded-[2rem] shadow-lg ring-1 ring-champagne/60"
        />
        <p className="text-center font-serif text-[1.4rem] leading-snug text-ink">
          Cội nguồn là nơi ta <strong className="text-wine">thuộc về</strong>, gia đình là nơi ta{" "}
          <strong className="text-wine">gắn kết</strong>, và lịch sử dòng tộc là di sản truyền lại cho muôn đời.
        </p>
      </section>
      <LoginForm />
    </>
  );
}
