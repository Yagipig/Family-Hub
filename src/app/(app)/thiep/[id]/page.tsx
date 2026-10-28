import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { getMyTimezone, loadNames } from "@/lib/cards-server";
import { GIFT_STATUS_LABEL, type GiftStatus } from "@/lib/cards";
import { formatGiftAmount } from "@/lib/cards-money";
import { getTemplate } from "@/lib/card-templates";
import { Alert, Card, buttonClass, buttonGhostClass } from "@/components/ui";
import { ConfirmButton } from "@/components/SubmitButton";
import { CardView, CardStyles } from "@/components/CardView";
import { CardOpener } from "@/components/CardOpener";
import { NoMoneyNotice } from "@/components/CardsNotice";
import { cancelCardAction, markCardOpened } from "../actions";

export const metadata = { title: "Thiệp" };

type Rec = { user_id: string; status: "unseen" | "opened"; opened_at: string | null };
type GiftRow = { id: string; sender_id: string; recipient_id: string; amount_minor: number | null; currency: string | null; status: GiftStatus; note: string | null };

export default async function CardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  // RLS: người ngoài / người nhận khi chưa tới giờ / thiệp đã huỷ => không có dòng => 404
  const { data: card } = await supabase
    .from("cards")
    .select("id, sender_id, template_key, title, message, audience_kind, scheduled_at, delivered_at")
    .eq("id", id).maybeSingle();
  if (!card) notFound();

  const isSender = card.sender_id === session.userId;
  const tz = await getMyTimezone(session.userId);
  const template = getTemplate(card.template_key);
  const [{ data: recData }, { data: giftData }] = await Promise.all([
    supabase.from("card_recipients").select("user_id, status, opened_at").eq("card_id", id),
    supabase.from("gifts").select("id, sender_id, recipient_id, amount_minor, currency, status, note").eq("card_id", id),
  ]);
  const recipients = (recData ?? []) as Rec[];
  const gifts = (giftData ?? []) as GiftRow[];
  const names = await loadNames([card.sender_id, ...recipients.map((r) => r.user_id)]);
  const senderName = names[card.sender_id] ?? "Người thân";
  const scheduledFuture = new Date(card.scheduled_at).getTime() > Date.now();
  const mine = recipients.find((r) => r.user_id === session.userId);

  return (
    <>
      <CardStyles />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-wine">{isSender ? "Thiệp của bạn" : `Thiệp từ ${senderName}`}</h1>
        <Link href="/thiep" className={buttonGhostClass}>Về hộp thư thiệp</Link>
      </div>
      {sp.ok && <Alert kind="ok">{sp.ok}</Alert>}
      {sp.error && <Alert kind="error">{sp.error}</Alert>}

      {isSender ? (
        <>
          {scheduledFuture ? (
            <Card className="space-y-3">
              <h2 className="text-xl font-bold">Đang hẹn giờ</h2>
              <p className="text-lg">Thiệp sẽ hiện với người nhận lúc <strong>{formatDateTime(card.scheduled_at, tz)}</strong> (giờ của bạn: {tz}). Trước đó họ không nhìn thấy thiệp.</p>
              <div className="flex flex-wrap gap-3">
                <Link href={`/thiep/moi?sua=${card.id}`} className={buttonClass}>Sửa thiệp</Link>
                <form action={cancelCardAction}>
                  <input type="hidden" name="cardId" value={card.id} />
                  <ConfirmButton message="Huỷ thiệp này? Người nhận sẽ không nhận được nữa." className="inline-flex min-h-12 items-center rounded-xl border border-danger px-5 text-base font-semibold text-danger hover:bg-red-50">Huỷ thiệp</ConfirmButton>
                </form>
              </div>
            </Card>
          ) : (
            <Card className="space-y-3">
              <h2 className="text-xl font-bold">Đã gửi lúc {formatDateTime(card.scheduled_at, tz)}</h2>
              <p className="text-base text-ink-soft">Lưu ý: bạn xem được ai đã mở thiệp và mở lúc nào; người nhận cũng được báo là người gửi biết điều này.</p>
              <form action={cancelCardAction}>
                <input type="hidden" name="cardId" value={card.id} />
                <ConfirmButton message="Thu hồi thiệp này? Người nhận sẽ không còn xem được." className="inline-flex min-h-12 items-center rounded-xl border border-danger px-5 text-base font-semibold text-danger hover:bg-red-50">Thu hồi thiệp</ConfirmButton>
              </form>
            </Card>
          )}
          <CardOpener preview template={template} title={card.title} message={card.message} senderName={senderName} alreadyOpened />

          <Card className="space-y-3">
            <h2 className="text-xl font-bold">Người nhận ({recipients.length})</h2>
            <ul className="divide-y divide-champagne/50">
              {recipients.map((r) => (
                <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-base">
                  <span className="font-semibold">{names[r.user_id] ?? "Thành viên"}</span>
                  {scheduledFuture ? <span className="text-ink-soft">Chưa gửi</span>
                    : r.status === "opened" ? <span className="font-semibold text-ok">Đã mở · {formatDateTime(r.opened_at, tz)}</span>
                    : <span className="text-ink-soft">Chưa mở</span>}
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        <CardOpener
          template={template} title={card.title} message={card.message} senderName={senderName}
          alreadyOpened={mine?.status === "opened"} onOpened={markCardOpened.bind(null, card.id)}
        />
      )}

      {gifts.length > 0 && (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Lì xì kèm thiệp</h2>
          <NoMoneyNotice />
          <ul className="divide-y divide-champagne/50">
            {gifts.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-base">
                <span>
                  <span className="font-semibold">{isSender ? `Cho ${names[g.recipient_id] ?? "người nhận"}` : "Dành cho bạn"}</span>
                  {" · "}{formatGiftAmount(g.amount_minor, g.currency)} <span className="text-ink-soft">(ghi nhận)</span>
                </span>
                <span className="font-semibold">{GIFT_STATUS_LABEL[g.status]}</span>
              </li>
            ))}
          </ul>
          <Link href="/li-xi" className={buttonGhostClass}>Mở trang Lì xì</Link>
        </Card>
      )}
    </>
  );
}
