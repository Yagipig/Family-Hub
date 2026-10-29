import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";

export const metadata = { title: "Quản trị" };

export default async function AdminHome() {
  const session = await requireAdmin("/admin");
  const links = [
    { href: "/admin/loi-moi", title: "Lời mời", text: "Tạo liên kết mời thành viên mới, xem và thu hồi lời mời." },
    { href: "/admin/quan-tri-vien", title: "Tài khoản và quản trị viên", text: "Xem tài khoản, thu hồi quyền, thêm hoặc đổi vai trò admin phụ." },
    { href: "/admin/gia-dinh", title: "Gia đình, nhánh họ, chế độ chỉnh sửa", text: "Tên, màu, múi giờ, nhánh họ, khóa hoặc mở khóa chỉnh sửa." },
    { href: "/admin/yeu-cau", title: "Yêu cầu chỉnh sửa gia phả", text: "Duyệt hoặc từ chối yêu cầu sửa do thành viên gửi, xem so sánh cũ và mới." },
    { href: "/admin/gan-ho-so", title: "Gắn tài khoản với hồ sơ", text: "Liên kết mỗi tài khoản với hồ sơ thành viên tương ứng trong gia phả." },
    { href: "/admin/nhap-xuat-gia-pha", title: "Nhập và xuất gia phả", text: "Xuất JSON hoặc CSV, nhập gia phả từ tệp JSON (thêm mới, không ghi đè)." },
    { href: "/admin/bao-cao", title: "Báo cáo tin nhắn", text: "Xử lý báo cáo tin nhắn: ẩn tin, gỡ thành viên khỏi nhóm." },
    { href: "/admin/kiem-duyet", title: "Kiểm duyệt bảng tin", text: "Xem báo cáo bài viết, ẩn hoặc xóa bài vi phạm." },
    { href: "/admin/anh-bia", title: "Ảnh bìa và dung lượng ảnh", text: "Chọn ảnh nền cho cả gia đình, xem mức dùng kho ảnh." },
    { href: "/admin/tro-choi", title: "Quản trị trò chơi", text: "Bật hoặc tắt trò chơi xu ảo, tạo bao lì xì may mắn, kỳ xổ số, phòng lô tô, bầu cua." },
    { href: "/admin/yeu-cau-du-lieu", title: "Yêu cầu về dữ liệu cá nhân", text: "Thành viên xin bản sao, sửa, hạn chế hoặc xóa dữ liệu của họ." },
    { href: "/admin/nhat-ky", title: "Nhật ký hoạt động", text: "Xem ai đã làm gì và khi nào (chỉ thêm, không sửa được)." },
  ];
  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Quản trị</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {links
          .filter((l) => session.role !== "branch_admin" || l.href !== "/admin/quan-tri-vien")
          .map((l) => (
            <Link key={l.href} href={l.href} className="block focus-visible:outline-none">
              <Card className="h-full hover:border-wine">
                <h2 className="text-xl font-bold text-wine">{l.title}</h2>
                <p className="mt-2 text-base text-ink-soft">{l.text}</p>
              </Card>
            </Link>
          ))}
      </div>
    </>
  );
}
