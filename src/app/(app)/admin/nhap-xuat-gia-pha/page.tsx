import { can, requireAdmin } from "@/lib/auth";
import { Alert, Card, buttonClass, buttonGhostClass } from "@/components/ui";
import { IMPORT_MAX_MEMBERS } from "@/lib/members-schemas";
import { ImportForm } from "./ImportForm";

export const metadata = { title: "Nhập / xuất gia phả" };

export default async function ImportExportPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireAdmin("/admin/nhap-xuat-gia-pha");
  const { ok, error } = await searchParams;
  // Quyền thật do RPC/route kiểm tra lại; ở đây chỉ để không hiện nút vô dụng
  const [canJson, canCsv, canImport] = await Promise.all([
    can(session, "tree", "export"), can(session, "members", "export"), can(session, "tree", "update"),
  ]);

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Nhập / xuất gia phả</h1>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Xuất gia phả (JSON)</h2>
        <p className="text-base text-ink-soft">
          Tải về toàn bộ thành viên và quan hệ để lưu giữ hoặc chuyển sang nơi khác. Tệp chứa <strong>thông tin riêng tư</strong> (ngày sinh, điện thoại, email) nên hãy cất giữ cẩn thận.
          Mỗi lần xuất đều được ghi vào nhật ký.
        </p>
        {canJson ? (
          <form method="post" action="/admin/nhap-xuat-gia-pha/xuat-json"><button className={buttonClass}>Tải tệp JSON</button></form>
        ) : <p className="text-base font-medium text-danger">Bạn không có quyền xuất gia phả.</p>}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Xuất danh sách thành viên (CSV, mở được bằng Excel)</h2>
        <p className="text-base text-ink-soft">
          Chỉ gồm những thông tin mà <strong>chính bạn</strong> được xem theo cài đặt riêng tư (mục bị ẩn sẽ để trống). Không có quan hệ gia đình trong tệp này. Mỗi lần xuất đều được ghi vào nhật ký.
        </p>
        {canCsv ? (
          <form method="post" action="/admin/nhap-xuat-gia-pha/xuat-csv"><button className={buttonGhostClass}>Tải tệp CSV</button></form>
        ) : <p className="text-base font-medium text-danger">Bạn không có quyền xuất danh sách thành viên.</p>}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Nhập gia phả (JSON)</h2>
        <div className="space-y-2 rounded-xl border border-danger bg-red-50 px-4 py-3 text-base">
          <p className="font-bold text-danger">Đọc kỹ trước khi nhập</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Nhập chỉ <strong>THÊM mới</strong> thành viên và quan hệ trong tệp; <strong>không ghi đè và không xóa</strong> dữ liệu đang có.</li>
            <li>Nhập lại cùng một tệp sẽ tạo ra <strong>bản sao trùng lặp</strong> — chỉ nhập một lần.</li>
            <li>Hãy <strong>xuất gia phả hiện tại ra JSON</strong> và sao lưu cơ sở dữ liệu trước khi nhập.</li>
            <li>Nếu tệp có lỗi (ví dụ tạo vòng lặp cha-con), <strong>không có gì</strong> được nhập.</li>
            <li>Nhánh họ được khớp theo <strong>tên</strong>; nhánh không có trong hệ thống sẽ để trống. Ảnh đại diện không được nhập.</li>
            <li>Giới hạn: tệp tối đa 5 MB và {IMPORT_MAX_MEMBERS} thành viên.</li>
          </ul>
        </div>
        {canImport ? <ImportForm action="/admin/nhap-xuat-gia-pha/nhap" /> : (
          <p className="text-base font-medium text-danger">Chỉ quản trị gia đình mới được nhập gia phả.</p>
        )}
      </Card>
    </>
  );
}
