import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { Alert, Card, Field, SelectField, buttonClass } from "@/components/ui";
import { addBranch, setEditing, updateFamily } from "./actions";

export const metadata = { title: "Gia đình và chế độ chỉnh sửa" };

type Mode = { editing_mode: string | null; editing_open_until: string | null };
function describe(m: Mode, tz: string, inherit = false) {
  if (!m.editing_mode) return inherit ? "Theo gia đình" : "Đang khóa";
  const expired = m.editing_open_until && new Date(m.editing_open_until) <= new Date();
  if (m.editing_mode === "open" && !expired)
    return m.editing_open_until ? `Đang mở đến ${formatDateTime(m.editing_open_until, tz)}` : "Đang mở";
  return "Đang khóa";
}

export default async function FamilyAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireAdmin("/admin/gia-dinh");
  const { ok, error } = await searchParams;
  const isFamilyLevel = session.role !== "branch_admin";
  const supabase = await createClient();
  const [{ data: family }, { data: branches }] = await Promise.all([
    supabase.from("families").select("name, primary_color, timezone, editing_mode, editing_open_until").eq("id", session.familyId).single(),
    supabase.from("branches").select("id, name, parent_branch_id, editing_mode, editing_open_until").order("name"),
  ]);
  const myBranches = isFamilyLevel ? (branches ?? []) : (branches ?? []).filter((b) => b.id === session.branchId);

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Gia đình và chế độ chỉnh sửa</h1>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Khóa / mở khóa chỉnh sửa</h2>
        <p className="text-base text-ink-soft">
          Khi khóa, chỉ quản trị viên được sửa dữ liệu; thành viên gửi yêu cầu để duyệt. Khi mở, thành viên được sửa theo quyền của mình.
          Có thể đặt giờ tự đóng lại.
        </p>
        {isFamilyLevel && family && (
          <p className="text-base"><strong>Toàn gia đình:</strong> {describe(family, session.timezone)}</p>
        )}
        <ul className="text-base">
          {myBranches.map((b) => (
            <li key={b.id}><strong>Nhánh {b.name}:</strong> {describe(b, session.timezone, true)}</li>
          ))}
        </ul>
        <form action={setEditing} className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Phạm vi" name="scope" defaultValue={isFamilyLevel ? "family" : (myBranches[0]?.id ?? "")}>
            {isFamilyLevel && <option value="family">Toàn gia đình</option>}
            {myBranches.map((b) => <option key={b.id} value={b.id}>Nhánh {b.name}</option>)}
          </SelectField>
          <SelectField label="Chế độ" name="mode" defaultValue="open">
            <option value="open">Mở khóa</option>
            <option value="locked">Khóa</option>
          </SelectField>
          <Field label="Tự đóng sau (giờ, 0 = không hẹn)" name="hours" type="number" min={0} max={1440} defaultValue={0} />
          <div className="sm:col-span-3"><button className={buttonClass}>Áp dụng</button></div>
        </form>
      </Card>

      {isFamilyLevel && (
        <>
          <Card className="space-y-4">
            <h2 className="text-xl font-bold">Thông tin gia đình</h2>
            <form action={updateFamily} className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên gia đình / dòng họ" name="name" defaultValue={family?.name} required maxLength={120} />
              <Field label="Múi giờ mặc định (ví dụ Asia/Ho_Chi_Minh)" name="timezone" defaultValue={family?.timezone} required />
              <Field label="Màu chủ đạo (mã #rrggbb, để trống = mặc định)" name="primaryColor" defaultValue={family?.primary_color ?? ""} pattern="#[0-9a-fA-F]{6}" />
              <div className="sm:col-span-2"><button className={buttonClass}>Lưu</button></div>
            </form>
            <p className="text-sm text-ink-soft">Logo và ảnh bìa sẽ được thêm cùng kho lưu trữ ảnh ở đợt sau.</p>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-xl font-bold">Nhánh họ</h2>
            {(branches ?? []).length === 0 ? (
              <p className="text-base text-ink-soft">Chưa có nhánh nào.</p>
            ) : (
              <ul className="text-base">
                {branches!.map((b) => (
                  <li key={b.id}>{b.name}{b.parent_branch_id ? ` (thuộc ${branches!.find((p) => p.id === b.parent_branch_id)?.name ?? "—"})` : ""}</li>
                ))}
              </ul>
            )}
            <form action={addBranch} className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên nhánh mới" name="name" required maxLength={120} />
              <SelectField label="Thuộc nhánh (tùy chọn)" name="parentId" defaultValue="">
                <option value="">— Nhánh gốc —</option>
                {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SelectField>
              <div className="sm:col-span-2"><button className={buttonClass}>Thêm nhánh</button></div>
            </form>
          </Card>
        </>
      )}
    </>
  );
}
