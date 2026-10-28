"use client";
import { useActionState } from "react";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { rsvpAction } from "./actions";

export function RsvpForm({
  eventId, occurrence, current,
}: {
  eventId: string;
  occurrence: string;
  current: { response: string; guests: number; note: string | null } | null;
}) {
  const [state, action] = useActionState(rsvpAction, null);
  const options = [
    { v: "yes", label: "Tôi sẽ tham dự" },
    { v: "maybe", label: "Có thể" },
    { v: "no", label: "Tôi không đi được" },
  ];
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="occurrence" value={occurrence} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="ok">{state.ok}</Alert>}
      <fieldset className="space-y-2">
        <legend className="text-base font-semibold">Bạn có tham dự không?</legend>
        {options.map((o) => (
          <label key={o.v} className="flex min-h-12 items-center gap-3 rounded-xl border border-champagne/60 bg-white px-4 text-base">
            <input type="radio" name="response" value={o.v} required defaultChecked={current?.response === o.v} className="size-5 accent-wine" />
            {o.label}
          </label>
        ))}
      </fieldset>
      <Field label="Số người đi cùng (không tính bạn)" name="guests" type="number" inputMode="numeric" min={0} max={20} defaultValue={current?.guests ?? 0} />
      <Field label="Ghi chú (không bắt buộc)" name="note" defaultValue={current?.note ?? ""} maxLength={300} />
      <SubmitButton>Gửi câu trả lời</SubmitButton>
    </form>
  );
}
