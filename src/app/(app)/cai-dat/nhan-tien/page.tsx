import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { payoutKeyConfigured } from "@/lib/crypto";
import { getMyTimezone, loadAudience } from "@/lib/cards-server";
import { PAYOUT_KIND_LABELS, type PayoutKind } from "@/lib/payout";
import { Alert, Card, SelectField, buttonClass, buttonGhostClass } from "@/components/ui";
import { ConfirmButton } from "@/components/SubmitButton";
import { PayoutAddForm } from "@/components/PayoutAddForm";
import { PayoutReveal } from "@/components/PayoutReveal";
import { NoMoneyNotice } from "@/components/CardsNotice";
import { addPayoutProfile, deletePayoutProfileAction, revealPayoutAction, revokePayoutShare, sharePayout } from "./actions";

export const metadata = { title: "Thông tin nhận tiền" };

type Profile = { id: string; kind: PayoutKind; label: string; last4: string | null; created_at: string };
type Share = { share_id: string; profile_id: string; shared_with: string; shared_with_name: string | null; expires_at: string; state: "active" | "expired" | "revoked" };
type Shared = { profile_id: string; owner_id: string; owner_name: string | null; kind: PayoutKind; label: string; last4: string | null; expires_at: string };

const STATE_LABEL = { active: "Đang chia sẻ", expired: "Đã hết hạn", revoked: "Đã thu hồi" } as const;
const HOURS = [[24, "1 ngày"], [72, "3 ngày"], [168, "7 ngày"], [720, "30 ngày"]] as const;

export default async function PayoutPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const supabase = await createClient();
  const tz = await getMyTimezone(session.userId);
  const [{ data: pData }, { data: sData }, { data: oData }, audience] = await Promise.all([
    supabase.rpc("my_payout_profiles", { p_family: session.familyId }),
    supabase.rpc("my_payout_shares", { p_family: session.familyId }),
    supabase.rpc("payout_profiles_shared_with_me", { p_family: session.familyId }),
    loadAudience(session.familyId),
  ]);
  const profiles = (pData ?? []) as Profile[];
  const shares = (sData ?? []) as Share[];
  const sharedWithMe = (oData ?? []) as Shared[];
  const keyOk = payoutKeyConfigured();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-wine">Thông tin nhận tiền</h1>
        <Link href="/li-xi" className={buttonGhostClass}>Về trang Lì xì</Link>
      </div>
      {sp.ok && <Alert kind="ok">{sp.ok}</Alert>}
      {sp.error && <Alert kind="error">{sp.error}</Alert>}
      <NoMoneyNotice extra="Thông tin ở đây chỉ để người thân biết nơi chuyển lì xì cho bạn." />
      <div role="note" className="rounded-xl border-2 border-danger bg-red-50 px-4 py-3 text-base font-semibold text-danger">
        TUYỆT ĐỐI không nhập mật khẩu, mã OTP, mã PIN, CVV hay số thẻ ngân hàng. Chỉ nhập số TÀI KHOẢN hoặc ID ví.
      </div>
      {!keyOk && (
        <Alert kind="error">Máy chủ chưa cấu hình khóa mã hóa (PAYOUT_ENC_KEY) nên chưa thể lưu hay xem thông tin nhận tiền. Hãy báo quản trị viên.</Alert>
      )}

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Cách thông tin này được bảo vệ</h2>
        <ul className="list-disc space-y-1 pl-6 text-base text-ink-soft">
          <li>Số tài khoản và tên chủ tài khoản được <strong>mã hóa</strong> trước khi lưu. Mặc định luôn hiển thị che (••••1234).</li>
          <li>Chỉ <strong>những người bạn chọn</strong> mới xem được, có <strong>hạn dùng</strong>, và bạn <strong>thu hồi</strong> được ngay.</li>
          <li>Quản trị viên <strong>không</strong> xem được nội dung của bạn. Họ chỉ thấy nhật ký “ai đã xem hồ sơ của ai”.</li>
          <li>Mỗi lần ai đó (kể cả bạn) bấm hiện thông tin đầy đủ đều được ghi vào nhật ký.</li>
        </ul>
      </Card>

      <section className="space-y-4" aria-label="Thông tin nhận tiền của tôi">
        <h2 className="text-2xl font-bold text-wine">Của tôi ({profiles.length}/10)</h2>
        {profiles.length === 0 && <Card><p className="text-lg text-ink-soft">Bạn chưa lưu thông tin nhận tiền nào.</p></Card>}
        {profiles.map((p) => {
          const mine = shares.filter((s) => s.profile_id === p.id);
          return (
            <Card key={p.id} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-bold">{p.label} <span className="text-base font-normal text-ink-soft">· {PAYOUT_KIND_LABELS[p.kind]}</span></h3>
                <form action={deletePayoutProfileAction}>
                  <input type="hidden" name="profileId" value={p.id} />
                  <ConfirmButton message="Xoá thông tin này và mọi lượt chia sẻ? Không khôi phục được." className="inline-flex min-h-12 items-center rounded-xl border border-danger px-5 text-base font-semibold text-danger hover:bg-red-50">Xoá</ConfirmButton>
                </form>
              </div>
              <PayoutReveal profileId={p.id} last4={p.last4} reveal={revealPayoutAction} who="self" />

              <div className="space-y-3 border-t border-champagne/50 pt-4">
                <h4 className="text-lg font-bold">Đang chia sẻ cho</h4>
                {mine.length === 0 && <p className="text-base text-ink-soft">Chưa chia sẻ cho ai.</p>}
                <ul className="divide-y divide-champagne/50">
                  {mine.map((s) => (
                    <li key={s.share_id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-base">
                      <span>
                        <strong>{s.shared_with_name ?? "Thành viên"}</strong> · {STATE_LABEL[s.state]}
                        {s.state === "active" && <> · hết hạn {formatDateTime(s.expires_at, tz)}</>}
                      </span>
                      {s.state === "active" && (
                        <form action={revokePayoutShare}>
                          <input type="hidden" name="shareId" value={s.share_id} />
                          <ConfirmButton message="Thu hồi quyền xem của người này ngay bây giờ?" className={buttonGhostClass}>Thu hồi</ConfirmButton>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
                <form action={sharePayout} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                  <input type="hidden" name="profileId" value={p.id} />
                  <input type="hidden" name="back" value="/cai-dat/nhan-tien" />
                  <SelectField label="Chia sẻ cho" name="userId" required defaultValue="">
                    <option value="" disabled>— Chọn người —</option>
                    {audience.map((a) => <option key={a.user_id} value={a.user_id}>{a.display_name}</option>)}
                  </SelectField>
                  <SelectField label="Trong" name="hours" defaultValue="168">
                    {HOURS.map(([h, label]) => <option key={h} value={h}>{label}</option>)}
                  </SelectField>
                  <button className={buttonClass}>Chia sẻ</button>
                </form>
              </div>
            </Card>
          );
        })}
      </section>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Thêm thông tin nhận tiền</h2>
        <PayoutAddForm action={addPayoutProfile} />
      </Card>

      <section className="space-y-4" aria-label="Thông tin người khác chia sẻ cho tôi">
        <h2 className="text-2xl font-bold text-wine">Người thân chia sẻ cho tôi ({sharedWithMe.length})</h2>
        {sharedWithMe.length === 0 && <Card><p className="text-lg text-ink-soft">Chưa có ai chia sẻ thông tin nhận tiền cho bạn (hoặc đã hết hạn).</p></Card>}
        {sharedWithMe.map((s) => (
          <Card key={s.profile_id} className="space-y-3">
            <h3 className="text-xl font-bold">{s.owner_name ?? "Người thân"} · {s.label}</h3>
            <p className="text-base text-ink-soft">{PAYOUT_KIND_LABELS[s.kind]} · được xem đến {formatDateTime(s.expires_at, tz)}</p>
            <PayoutReveal profileId={s.profile_id} last4={s.last4} reveal={revealPayoutAction} who="other" />
          </Card>
        ))}
      </section>
    </>
  );
}
