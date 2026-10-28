"use client";
import { useActionState } from "react";
import { Alert, Field } from "@/components/ui";
import { cancelEventAction } from "./actions";

export function CancelForm({ eventId }: { eventId: string }) {
  const [state, action] = useActionState(cancelEventAction, null);
  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(e) => {
        if (!window.confirm("Huỷ sự kiện này? Người đã trả lời tham dự sẽ nhận thông báo.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="eventId" value={eventId} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="ok">{state.ok}</Alert>}
      <Field label="Lý do huỷ (không bắt buộc)" name="reason" maxLength={500} />
      <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-danger px-5 py-2 text-base font-semibold text-danger hover:bg-red-50">
        Huỷ sự kiện
      </button>
    </form>
  );
}
