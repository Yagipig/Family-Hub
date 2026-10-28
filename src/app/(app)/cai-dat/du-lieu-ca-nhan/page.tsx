import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { DATA_REQUEST_KINDS, DATA_REQUEST_LABELS, DATA_REQUEST_STATUS_LABELS } from "@/lib/data-requests";
import { Alert, Card, SelectField, buttonClass, buttonGhostClass } from "@/components/ui";
import { SubmitButton, ConfirmButton } from "@/components/SubmitButton";
import { cancelRequest, submitRequest } from "./actions";

export const metadata = { title: "Dữ liệu cá nhân của tôi" };

export default async function PersonalDataPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireSession();
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: rows } = await supabase.from("data_requests")
    .select("id, kind, note, status, handler_note, created_at, handled_at").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(50);

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Dữ liệu cá nhân của tôi</h1>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Tải về dữ liệu của tôi</h2>
        <p className="text-base text-ink-soft">
          Tệp JSON gồm hồ sơ tài khoản, hồ sơ thành viên gắn với bạn (theo đúng phần bạn được xem), tùy chọn thông báo, các yêu cầu chỉnh sửa và thông báo của bạn.
          Mỗi lần tải được ghi vào nhật ký. Thông tin nhận tiền không nằm trong tệp (đã mã hóa).
        </p>
        <Link href="/cai-dat/du-lieu-ca-nhan/xuat" prefetch={false} className={buttonClass}>Tải dữ liệu của tôi (JSON)</Link>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Gửi yêu cầu cho quản trị viên</h2>
        <p className="text-base text-ink-soft">Bạn có quyền hỏi về, sửa, hạn chế hoặc xóa dữ liệu của mình. Quản trị viên sẽ xử lý bằng tay và báo lại; các yêu cầu xóa cần xác minh trực tiếp.</p>
        <form action={submitRequest} className="space-y-4">
          <SelectField label="Bạn muốn gì?" name="kind" defaultValue="export">
            {DATA_REQUEST_KINDS.map((k) => <option key={k} value={k}>{DATA_REQUEST_LABELS[k]}</option>)}
          </SelectField>
          <label className="block text-base font-semibold">
            Ghi chú (tùy chọn)
            <textarea name="note" rows={3} maxLength={1000}
              className="mt-1 block w-full rounded-xl border border-ink-soft/40 bg-white px-4 py-2 text-base text-ink" />
          </label>
          <SubmitButton>Gửi yêu cầu</SubmitButton>
        </form>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Yêu cầu của tôi</h2>
        {(rows ?? []).length === 0 ? <p className="text-base text-ink-soft">Bạn chưa gửi yêu cầu nào.</p> : (
          <ul className="divide-y divide-champagne/50">
            {rows!.map((r) => (
              <li key={r.id} className="space-y-1 py-3 text-base">
                <p><strong>{DATA_REQUEST_LABELS[r.kind as keyof typeof DATA_REQUEST_LABELS]}</strong> — {DATA_REQUEST_STATUS_LABELS[r.status]}</p>
                <p className="text-sm text-ink-soft">Gửi lúc {formatDateTime(r.created_at, session.timezone)}{r.handled_at ? ` · Xử lý lúc ${formatDateTime(r.handled_at, session.timezone)}` : ""}</p>
                {r.note && <p>Ghi chú của bạn: {r.note}</p>}
                {r.handler_note && <p>Phản hồi: {r.handler_note}</p>}
                {r.status === "pending" && (
                  <form action={cancelRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <ConfirmButton message="Hủy yêu cầu này?" className={buttonGhostClass}>Hủy yêu cầu</ConfirmButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
