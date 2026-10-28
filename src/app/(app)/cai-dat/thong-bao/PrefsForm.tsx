"use client";
import { useActionState } from "react";
import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { LEAD_CHOICES, LEAD_LABEL, type PrefsInput } from "@/lib/notification-prefs";
import { savePreferences } from "./actions";

function Check({ name, label, defaultChecked, value }: { name: string; label: string; defaultChecked: boolean; value?: string }) {
  return (
    <label className="flex min-h-12 items-center gap-3 text-base font-semibold">
      <input type="checkbox" name={name} value={value ?? "on"} defaultChecked={defaultChecked} className="size-6 accent-wine" />
      {label}
    </label>
  );
}

export function PrefsForm({ prefs }: { prefs: PrefsInput }) {
  const [state, action] = useActionState(savePreferences, null);
  return (
    <form action={action} className="space-y-6">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="ok">{state.ok}</Alert>}
      <fieldset className="space-y-1">
        <legend className="text-lg font-bold">Sinh nhật và ngày giỗ</legend>
        <Check name="birthdays" label="Báo sinh nhật" defaultChecked={prefs.birthdays} />
        <Check name="death" label="Báo ngày giỗ" defaultChecked={prefs.death} />
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="text-lg font-bold">Báo trước bao lâu?</legend>
        <p className="text-sm text-ink-soft">Chọn tối đa 6 mốc. Áp dụng cho cả sinh nhật và ngày giỗ.</p>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {LEAD_CHOICES.map((n) => <Check key={n} name="lead" value={String(n)} label={LEAD_LABEL[n]} defaultChecked={prefs.leads.includes(n)} />)}
        </div>
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="text-lg font-bold">Loại thông báo khác</legend>
        <Check name="events" label="Sự kiện và nhắc sự kiện" defaultChecked={prefs.events} />
        <Check name="cards" label="Thiệp và lì xì" defaultChecked={prefs.cards} />
        <Check name="gifts" label="Quà tặng" defaultChecked={prefs.gifts} />
        <Check name="chat" label="Tin nhắn" defaultChecked={prefs.chat} />
      </fieldset>
      <SubmitButton>Lưu tuỳ chọn</SubmitButton>
    </form>
  );
}
