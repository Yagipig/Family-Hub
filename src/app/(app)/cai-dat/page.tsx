import Link from "next/link";
import { requireSession, ROLE_LABELS } from "@/lib/auth";
import { Card, buttonClass, buttonGhostClass } from "@/components/ui";
import { signOut } from "@/app/actions/auth";
import { ProfileForm } from "./ProfileForm";
import { InstallApp } from "@/components/InstallApp";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("user_profiles").select("alias_name").eq("id", session.userId).maybeSingle();
  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Cài đặt</h1>
      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Hồ sơ của tôi</h2>
        <p className="text-base text-ink-soft">Email: {session.email} · Vai trò: {ROLE_LABELS[session.role]}</p>
        <ProfileForm displayName={session.displayName} aliasName={(profile as { alias_name: string | null } | null)?.alias_name ?? null} />
      </Card>
      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Ghim app ra màn hình chính</h2>
        <p className="text-base text-ink-soft">Ghim My Family ra màn hình chính điện thoại để mở nhanh như một ứng dụng, không cần mở trình duyệt gõ địa chỉ.</p>
        <InstallApp />
      </Card>
      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Bảo mật</h2>
        <p className="text-base text-ink-soft">Xác thực hai lớp bằng ứng dụng trên điện thoại. Bắt buộc với quản trị viên.</p>
        <Link href="/cai-dat/bao-mat" className={buttonGhostClass}>Thiết lập xác thực hai lớp</Link>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Thông báo và vị trí</h2>
        <p className="text-base text-ink-soft">Chọn loại thông báo muốn nhận, và quốc gia/múi giờ nơi bạn đang sống để giờ giấc hiển thị đúng.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/cai-dat/thong-bao" className={buttonGhostClass}>Tùy chọn thông báo</Link>
          <Link href="/cai-dat/vi-tri" className={buttonGhostClass}>Quốc gia và múi giờ</Link>
        </div>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Dữ liệu cá nhân</h2>
        <p className="text-base text-ink-soft">Tải về dữ liệu của bạn, hoặc gửi yêu cầu sửa, hạn chế hay xóa cho quản trị viên.</p>
        <Link href="/cai-dat/du-lieu-ca-nhan" className={buttonGhostClass}>Dữ liệu cá nhân của tôi</Link>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Thông tin nhận lì xì</h2>
        <p className="text-base text-ink-soft">Tùy chọn. Thông tin được mã hóa, mặc định ẩn và chỉ chia sẻ cho người bạn chọn. Family Hub không chuyển tiền.</p>
        <Link href="/cai-dat/nhan-tien" className={buttonGhostClass}>Quản lý thông tin nhận tiền</Link>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Tài khoản</h2>
        <p className="text-base text-ink-soft">Đang đăng nhập bằng {session.email}. Đăng xuất khi dùng máy chung để bảo vệ tài khoản của bạn.</p>
        <form action={signOut}>
          <button className={buttonClass}>Đăng xuất</button>
        </form>
      </Card>
    </>
  );
}
