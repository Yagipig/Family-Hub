import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, buttonGhostClass } from "@/components/ui";
import { DEFAULT_LEADS, type PrefsInput } from "@/lib/notification-prefs";
import { PrefsForm } from "./PrefsForm";

export const metadata = { title: "Tuỳ chọn thông báo" };

export default async function NotificationSettingsPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("birthdays, birthday_lead_days, death_anniversaries, events, cards, gifts, chat")
    .eq("user_id", session.userId)
    .eq("family_id", session.familyId)
    .maybeSingle();
  const prefs: PrefsInput = data
    ? {
        birthdays: data.birthdays, leads: (data.birthday_lead_days as number[]) ?? DEFAULT_LEADS, death: data.death_anniversaries,
        events: data.events, cards: data.cards, gifts: data.gifts, chat: data.chat,
      }
    : { birthdays: true, leads: DEFAULT_LEADS, death: true, events: true, cards: true, gifts: true, chat: true };
  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Tuỳ chọn thông báo</h1>
      <Card className="space-y-4">
        <p className="text-base text-ink-soft">
          Thông báo được tạo mỗi ngày một lần. Bạn chỉ nhận thông báo về những người mà bạn được phép xem ngày sinh hoặc ngày giỗ.
          &ldquo;Hôm nay&rdquo; được tính theo múi giờ của bạn (<Link href="/cai-dat/vi-tri" className="font-semibold text-wine underline">đổi múi giờ</Link>).
        </p>
        <PrefsForm prefs={prefs} />
      </Card>
      <Link href="/cai-dat" className={buttonGhostClass}>Quay lại cài đặt</Link>
    </>
  );
}
