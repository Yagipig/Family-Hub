import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { Card, buttonClass } from "@/components/ui";

export const metadata = { title: "Không có quyền truy cập" };

export default async function NoAccessPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/dang-nhap");
  if (await getSession()) redirect("/");
  return (
    <Card className="space-y-4">
      <h2 className="text-xl font-bold">Tài khoản chưa có quyền truy cập</h2>
      <p className="text-base text-ink-soft">
        Quyền của tài khoản này đã bị thu hồi hoặc chưa được cấp. Vui lòng liên hệ quản trị viên gia đình.
      </p>
      <form action={signOut}><button className={buttonClass}>Đăng xuất</button></form>
    </Card>
  );
}
