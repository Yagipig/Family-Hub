import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canUseCards, getMyTimezone, loadAudience, loadBranches } from "@/lib/cards-server";
import { nowLocalInput, utcToLocalInput } from "@/lib/cards-tz";
import { CardComposeForm, type ComposeInitial } from "@/components/CardComposeForm";
import { Alert, Card } from "@/components/ui";
import { saveCard } from "../actions";

export const metadata = { title: "Viết thiệp mới" };

export default async function NewCardPage({ searchParams }: { searchParams: Promise<{ sua?: string }> }) {
  const session = await requireSession();
  const { sua } = await searchParams;
  if (!(await canUseCards(session.familyId, "cards", "create")))
    return (
      <>
        <h1 className="text-3xl font-bold text-wine">Viết thiệp mới</h1>
        <Alert kind="error">Tài khoản của bạn chưa được phép gửi thiệp. Hãy liên hệ quản trị viên.</Alert>
      </>
    );

  const supabase = await createClient();
  const tz = await getMyTimezone(session.userId);
  const [audience, branches] = await Promise.all([loadAudience(session.familyId), loadBranches()]);

  let initial: ComposeInitial | undefined;
  let lockRecipients = false;
  if (sua) {
    const { data: card } = await supabase
      .from("cards")
      .select("id, sender_id, template_key, title, message, audience_kind, audience_branch_id, scheduled_at, delivered_at")
      .eq("id", sua).maybeSingle();
    if (!card || card.sender_id !== session.userId) notFound();
    if (card.delivered_at || new Date(card.scheduled_at).getTime() <= Date.now()) redirect(`/thiep/${sua}?error=${encodeURIComponent("Thiệp đã đến giờ gửi nên không sửa được nữa.")}`);
    const [{ data: recs }, { count: giftCount }] = await Promise.all([
      supabase.from("card_recipients").select("user_id").eq("card_id", sua),
      supabase.from("gifts").select("id", { count: "exact", head: true }).eq("card_id", sua).neq("status", "cancelled"),
    ]);
    lockRecipients = (giftCount ?? 0) > 0;
    initial = {
      templateKey: card.template_key, title: card.title ?? "", message: card.message,
      audienceKind: card.audience_kind, userIds: (recs ?? []).map((r: { user_id: string }) => r.user_id),
      branchId: card.audience_branch_id ?? "", scheduled: true,
      scheduledLocal: utcToLocalInput(new Date(card.scheduled_at), tz),
    };
  }

  return (
    <>
      <h1 className="text-3xl font-bold text-wine">{sua ? "Sửa thiệp hẹn giờ" : "Viết thiệp mới"}</h1>
      {audience.length === 0 && (
        <Card><p className="text-base text-ink-soft">Chưa có thành viên nào khác trong gia đình để gửi thiệp tới.</p></Card>
      )}
      <CardComposeForm
        action={saveCard} audience={audience} branches={branches}
        senderName={session.displayName} senderTz={tz} initialLocal={nowLocalInput(tz, 60)}
        initial={initial} editCardId={sua} lockRecipients={lockRecipients}
      />
    </>
  );
}
