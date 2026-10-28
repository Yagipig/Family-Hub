import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { getMyTimezone, loadNames, deliverMyDueCards } from "@/lib/cards-server";
import { getTemplate } from "@/lib/card-templates";
import { Alert, Card, buttonClass } from "@/components/ui";
import { CardThumb } from "@/components/CardView";

export const metadata = { title: "Thiệp điện tử" };

type CardRow = {
  id: string; title: string | null; template_key: string; scheduled_at: string; delivered_at: string | null;
  sender_id: string; audience_kind: string; created_at: string;
};
type RecipientRow = { card_id: string; user_id: string; status: "unseen" | "opened"; opened_at: string | null };

const TABS = [
  { key: "nhan", label: "Thiệp nhận được" },
  { key: "da-gui", label: "Thiệp đã gửi" },
  { key: "hen-gio", label: "Đang hẹn giờ" },
] as const;

export default async function CardsInboxPage({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; error?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as (typeof TABS)[number]["key"]) : "nhan";

  await deliverMyDueCards(); // tạo thông báo còn thiếu cho chính mình (giao lười, không cần cron)
  const supabase = await createClient();
  const tz = await getMyTimezone(session.userId);
  // RLS: chỉ trả về thiệp tôi gửi + thiệp gửi cho tôi đã tới giờ
  const { data: cardsData } = await supabase
    .from("cards")
    .select("id, title, template_key, scheduled_at, delivered_at, sender_id, audience_kind, created_at")
    .order("scheduled_at", { ascending: false })
    .limit(200);
  const cards = (cardsData ?? []) as CardRow[];
  const ids = cards.map((c) => c.id);
  const { data: recData } = ids.length
    ? await supabase.from("card_recipients").select("card_id, user_id, status, opened_at").in("card_id", ids)
    : { data: [] };
  const recipients = (recData ?? []) as RecipientRow[];
  const names = await loadNames([...cards.map((c) => c.sender_id), ...recipients.map((r) => r.user_id)]);

  const nowMs = Date.now();
  const mine = (c: CardRow) => c.sender_id === session.userId;
  const lists = {
    nhan: cards.filter((c) => !mine(c)),
    "da-gui": cards.filter((c) => mine(c) && new Date(c.scheduled_at).getTime() <= nowMs),
    "hen-gio": cards.filter((c) => mine(c) && new Date(c.scheduled_at).getTime() > nowMs).reverse(),
  };
  const unseenCount = lists.nhan.filter((c) => recipients.find((r) => r.card_id === c.id && r.user_id === session.userId)?.status === "unseen").length;
  const rows = lists[tab];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-wine">Thiệp điện tử</h1>
        <div className="flex flex-wrap gap-3">
          <Link href="/li-xi" className="inline-flex min-h-12 items-center rounded-xl border border-wine px-5 text-base font-semibold text-wine hover:bg-champagne-soft">Lì xì</Link>
          <Link href="/thiep/moi" className={buttonClass}>Viết thiệp mới</Link>
        </div>
      </div>
      {sp.ok && <Alert kind="ok">{sp.ok}</Alert>}
      {sp.error && <Alert kind="error">{sp.error}</Alert>}

      <nav aria-label="Loại thiệp" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/thiep?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined}
            className={`inline-flex min-h-12 items-center rounded-xl border px-5 text-base font-semibold ${t.key === tab ? "border-wine bg-wine text-white" : "border-wine text-wine hover:bg-champagne-soft"}`}>
            {t.label}
            {t.key === "nhan" && unseenCount > 0 && <span className="ml-2 rounded-full bg-champagne px-2 py-0.5 text-sm text-ink">{unseenCount} mới</span>}
            <span className="ml-2 text-sm opacity-80">({lists[t.key].length})</span>
          </Link>
        ))}
      </nav>

      {tab === "da-gui" && <p className="text-base text-ink-soft">Bạn xem được ai đã mở thiệp và mở lúc nào. Người nhận được báo là người gửi sẽ biết điều này.</p>}
      {tab === "hen-gio" && <p className="text-base text-ink-soft">Người nhận chưa nhìn thấy các thiệp này. Bạn có thể xem, sửa hoặc huỷ trước giờ gửi.</p>}

      {rows.length === 0 ? (
        <Card><p className="text-lg text-ink-soft">
          {tab === "nhan" ? "Chưa có thiệp nào gửi tới bạn." : tab === "da-gui" ? "Bạn chưa gửi thiệp nào." : "Không có thiệp nào đang hẹn giờ."}
        </p></Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => {
            const tpl = getTemplate(c.template_key);
            const rec = recipients.filter((r) => r.card_id === c.id);
            const me = rec.find((r) => r.user_id === session.userId);
            const opened = rec.filter((r) => r.status === "opened").length;
            return (
              <li key={c.id}>
                <Link href={`/thiep/${c.id}`} className="flex items-center gap-4 rounded-2xl border border-champagne/60 bg-ivory p-4 shadow-sm hover:bg-champagne-soft">
                  <CardThumb template={tpl} className="w-20 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold">{c.title?.trim() || tpl.name}</span>
                    <span className="block text-base text-ink-soft">
                      {mine(c)
                        ? `Gửi cho ${c.audience_kind === "family" ? "cả gia đình" : c.audience_kind === "branch" ? "cả nhánh" : `${rec.length} người`}`
                        : `Từ ${names[c.sender_id] ?? "người thân"}`}
                      {" · "}{formatDateTime(c.scheduled_at, tz)}
                    </span>
                    {mine(c) && new Date(c.scheduled_at).getTime() <= nowMs && (
                      <span className="block text-sm text-ink-soft">Đã mở: {opened}/{rec.length} người</span>
                    )}
                    {mine(c) && new Date(c.scheduled_at).getTime() > nowMs && (
                      <span className="block text-sm font-semibold text-wine">Hẹn giờ · chưa gửi</span>
                    )}
                  </span>
                  {!mine(c) && me?.status === "unseen" && <span className="shrink-0 rounded-full bg-wine px-3 py-1 text-sm font-semibold text-white">Mới</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-sm text-ink-soft">Giờ hiển thị theo múi giờ của bạn: {tz}.</p>
    </>
  );
}
