import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { canUseCards, deliverMyDueCards, getMyTimezone, loadAudience, loadNames } from "@/lib/cards-server";
import { GIFT_ACTION_LABEL, GIFT_STATUS_LABEL, giftActionsFor, type GiftAction, type GiftStatus } from "@/lib/cards";
import { SUPPORTED_CURRENCIES, formatGiftAmount } from "@/lib/cards-money";
import { PAYOUT_KIND_LABELS, type PayoutKind } from "@/lib/payout";
import { Alert, Card, Field, SelectField, buttonClass, buttonGhostClass } from "@/components/ui";
import { NoMoneyNotice } from "@/components/CardsNotice";
import { PayoutReveal } from "@/components/PayoutReveal";
import { revealPayoutAction, sharePayout } from "../cai-dat/nhan-tien/actions";
import { createGiftAction, giftTransitionAction } from "./actions";

export const metadata = { title: "Lì xì" };

type Gift = {
  id: string; card_id: string | null; sender_id: string; recipient_id: string; amount_minor: number | null; currency: string | null;
  note: string | null; status: GiftStatus; created_at: string; sender_marked_at: string | null; recipient_confirmed_at: string | null; dispute_note: string | null;
};
type Shared = { profile_id: string; owner_id: string; owner_name: string | null; kind: PayoutKind; label: string; last4: string | null; expires_at: string };
type Profile = { id: string; kind: PayoutKind; label: string };

const BADGE: Record<GiftStatus, string> = {
  pledged: "bg-champagne-soft text-ink",
  sender_marked_sent: "bg-amber-100 text-ink",
  recipient_confirmed: "bg-green-100 text-ok",
  cancelled: "bg-stone-200 text-ink-soft",
  disputed: "bg-red-100 text-danger",
};

function ActionButtons({ gift, role }: { gift: Gift; role: "sender" | "recipient" }) {
  const actions = giftActionsFor(gift.status, role);
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-end gap-3">
      {actions.map((a: GiftAction) => (
        <form key={a} action={giftTransitionAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="giftId" value={gift.id} />
          <input type="hidden" name="action" value={a} />
          {a === "dispute" && (
            <label className="text-sm font-semibold">
              Ghi chú (không bắt buộc)
              <input name="note" maxLength={500} className="mt-1 block min-h-12 rounded-xl border border-ink-soft/40 bg-white px-3 text-base" />
            </label>
          )}
          <button className={a === "cancel" || a === "dispute" ? buttonGhostClass : buttonClass}>{GIFT_ACTION_LABEL[a]}</button>
        </form>
      ))}
    </div>
  );
}

export default async function GiftsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  await deliverMyDueCards();
  const supabase = await createClient();
  const tz = await getMyTimezone(session.userId);
  const [{ data: gData }, { data: sData }, { data: pData }, audience, canGift] = await Promise.all([
    supabase.from("gifts")
      .select("id, card_id, sender_id, recipient_id, amount_minor, currency, note, status, created_at, sender_marked_at, recipient_confirmed_at, dispute_note")
      .order("created_at", { ascending: false }).limit(200),
    supabase.rpc("payout_profiles_shared_with_me", { p_family: session.familyId }),
    supabase.rpc("my_payout_profiles", { p_family: session.familyId }),
    loadAudience(session.familyId),
    canUseCards(session.familyId, "gifts", "create"),
  ]);
  const gifts = (gData ?? []) as Gift[];
  const sharedWithMe = (sData ?? []) as Shared[];
  const myProfiles = (pData ?? []) as Profile[];
  const names = await loadNames(gifts.flatMap((g) => [g.sender_id, g.recipient_id]));
  const received = gifts.filter((g) => g.recipient_id === session.userId);
  const sent = gifts.filter((g) => g.sender_id === session.userId);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-wine">Lì xì</h1>
        <div className="flex flex-wrap gap-3">
          <Link href="/thiep" className={buttonGhostClass}>Thiệp</Link>
          <Link href="/cai-dat/nhan-tien" className={buttonGhostClass}>Thông tin nhận tiền của tôi</Link>
        </div>
      </div>
      {sp.ok && <Alert kind="ok">{sp.ok}</Alert>}
      {sp.error && <Alert kind="error">{sp.error}</Alert>}
      <NoMoneyNotice extra="Quy trình: người gửi tự chuyển tiền bằng ngân hàng/ví của họ → bấm “Tôi đã chuyển” → người nhận kiểm tra → bấm “Tôi đã nhận được”." />

      <section className="space-y-4" aria-label="Lì xì tôi nhận">
        <h2 className="text-2xl font-bold text-wine">Tôi nhận ({received.length})</h2>
        {received.length === 0 && <Card><p className="text-lg text-ink-soft">Chưa có lì xì nào dành cho bạn.</p></Card>}
        {received.map((g) => (
          <Card key={g.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xl font-bold">Từ {names[g.sender_id] ?? "người thân"}</h3>
              <span className={`rounded-full px-3 py-1 text-base font-semibold ${BADGE[g.status]}`}>{GIFT_STATUS_LABEL[g.status]}</span>
            </div>
            <p className="text-lg">Số tiền ghi nhận: <strong>{formatGiftAmount(g.amount_minor, g.currency)}</strong></p>
            {g.note && <p className="text-base">Lời nhắn: {g.note}</p>}
            <p className="text-sm text-ink-soft">Hẹn lúc {formatDateTime(g.created_at, tz)}{g.sender_marked_at && <> · người gửi báo đã chuyển lúc {formatDateTime(g.sender_marked_at, tz)}</>}{g.card_id && <> · <Link className="underline" href={`/thiep/${g.card_id}`}>xem thiệp kèm theo</Link></>}</p>
            <ActionButtons gift={g} role="recipient" />
            {(g.status === "pledged" || g.status === "disputed" || g.status === "sender_marked_sent") && (
              <div className="space-y-2 border-t border-champagne/50 pt-3">
                <h4 className="text-lg font-bold">Cho {names[g.sender_id] ?? "người gửi"} biết nơi chuyển tiền</h4>
                {myProfiles.length === 0 ? (
                  <p className="text-base text-ink-soft">Bạn chưa lưu thông tin nhận tiền. <Link className="font-semibold text-wine underline" href="/cai-dat/nhan-tien">Thêm thông tin nhận tiền</Link> (được mã hóa; bạn chọn ai xem được và trong bao lâu), hoặc nhắn trực tiếp cho người gửi.</p>
                ) : (
                  <form action={sharePayout} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                    <input type="hidden" name="userId" value={g.sender_id} />
                    <input type="hidden" name="back" value="/li-xi" />
                    <SelectField label="Thông tin chia sẻ" name="profileId" required defaultValue="">
                      <option value="" disabled>— Chọn —</option>
                      {myProfiles.map((p) => <option key={p.id} value={p.id}>{p.label} ({PAYOUT_KIND_LABELS[p.kind]})</option>)}
                    </SelectField>
                    <SelectField label="Trong" name="hours" defaultValue="168">
                      <option value="24">1 ngày</option><option value="72">3 ngày</option><option value="168">7 ngày</option><option value="720">30 ngày</option>
                    </SelectField>
                    <button className={buttonClass}>Chia sẻ có thời hạn</button>
                  </form>
                )}
              </div>
            )}
          </Card>
        ))}
      </section>

      <section className="space-y-4" aria-label="Lì xì tôi gửi">
        <h2 className="text-2xl font-bold text-wine">Tôi gửi ({sent.length})</h2>
        {sent.length === 0 && <Card><p className="text-lg text-ink-soft">Bạn chưa hẹn lì xì nào.</p></Card>}
        {sent.map((g) => {
          const theirs = sharedWithMe.filter((s) => s.owner_id === g.recipient_id);
          const needsPayout = g.status === "pledged" || g.status === "disputed";
          return (
            <Card key={g.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-bold">Cho {names[g.recipient_id] ?? "người thân"}</h3>
                <span className={`rounded-full px-3 py-1 text-base font-semibold ${BADGE[g.status]}`}>{GIFT_STATUS_LABEL[g.status]}</span>
              </div>
              <p className="text-lg">Số tiền ghi nhận: <strong>{formatGiftAmount(g.amount_minor, g.currency)}</strong></p>
              {g.note && <p className="text-base">Lời nhắn: {g.note}</p>}
              {g.status === "disputed" && <p className="rounded-xl bg-red-50 px-4 py-2 text-base text-danger">Người nhận báo chưa nhận được{g.dispute_note ? `: “${g.dispute_note}”` : ""}. Hãy kiểm tra giao dịch rồi trao đổi với họ.</p>}
              <p className="text-sm text-ink-soft">Hẹn lúc {formatDateTime(g.created_at, tz)}{g.recipient_confirmed_at && <> · người nhận xác nhận lúc {formatDateTime(g.recipient_confirmed_at, tz)}</>}{g.card_id && <> · <Link className="underline" href={`/thiep/${g.card_id}`}>xem thiệp kèm theo</Link></>}</p>
              {needsPayout && (
                <div className="space-y-3 border-t border-champagne/50 pt-3">
                  <h4 className="text-lg font-bold">Nơi chuyển tiền của {names[g.recipient_id] ?? "người nhận"}</h4>
                  {theirs.length === 0 ? (
                    <p className="text-base text-ink-soft">Người nhận chưa chia sẻ thông tin nhận tiền cho bạn (hoặc đã hết hạn). Hãy nhắn hỏi họ; họ có thể chia sẻ ngay trong trang này của họ.</p>
                  ) : theirs.map((s) => (
                    <div key={s.profile_id} className="rounded-xl border border-champagne/60 bg-white p-3">
                      <p className="text-base font-semibold">{s.label} · {PAYOUT_KIND_LABELS[s.kind]} <span className="font-normal text-ink-soft">(được xem đến {formatDateTime(s.expires_at, tz)})</span></p>
                      <PayoutReveal profileId={s.profile_id} last4={s.last4} reveal={revealPayoutAction} who="other" />
                    </div>
                  ))}
                  <p className="text-sm text-ink-soft">Mỗi lần bạn bấm hiện thông tin đều được ghi vào nhật ký. Chuyển tiền xong, hãy bấm “Tôi đã chuyển”.</p>
                </div>
              )}
              <ActionButtons gift={g} role="sender" />
            </Card>
          );
        })}
      </section>

      {canGift && (
        <Card className="space-y-4">
          <h2 className="text-xl font-bold">Hẹn lì xì mới (không kèm thiệp)</h2>
          <p className="text-base text-ink-soft">Muốn kèm lời chúc đẹp? Hãy <Link className="font-semibold text-wine underline" href="/thiep/moi">viết thiệp</Link> và đính kèm lì xì ở bước 5.</p>
          <form action={createGiftAction} className="grid gap-4 sm:grid-cols-2" autoComplete="off">
            <SelectField label="Người nhận" name="recipientId" required defaultValue="">
              <option value="" disabled>— Chọn người —</option>
              {audience.map((a) => <option key={a.user_id} value={a.user_id}>{a.display_name}</option>)}
            </SelectField>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field label="Số tiền ghi nhận" name="amount" inputMode="decimal" placeholder="500.000" hint="Để trống nếu không ghi số tiền." />
              <SelectField label="Loại" name="currency" defaultValue="VND">{SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</SelectField>
            </div>
            <div className="sm:col-span-2"><Field label="Lời nhắn (không bắt buộc)" name="note" maxLength={500} /></div>
            <div className="sm:col-span-2"><button className={buttonClass}>Hẹn lì xì</button></div>
          </form>
        </Card>
      )}
    </>
  );
}
