"use client";
import { useActionState } from "react";
import { PAYOUT_KINDS, PAYOUT_KIND_LABELS } from "@/lib/payout";
import type { FormState } from "@/lib/schemas";
import { Alert, Field, SelectField } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function PayoutAddForm({ action }: { action: (prev: FormState, fd: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2" autoComplete="off">
      <div className="sm:col-span-2 space-y-3">
        {state?.error && <Alert kind="error">{state.error}</Alert>}
        {state?.ok && <Alert kind="ok">{state.ok}</Alert>}
      </div>
      <SelectField label="Loại" name="kind" defaultValue="bank" required>
        {PAYOUT_KINDS.map((k) => <option key={k} value={k}>{PAYOUT_KIND_LABELS[k]}</option>)}
      </SelectField>
      <Field label="Tên gợi nhớ" name="label" maxLength={60} required hint="Ví dụ: Vietcombank của tôi, Ví MoMo" />
      <Field label="Tên chủ tài khoản" name="holder" maxLength={120} required autoComplete="off" />
      <Field label="Số tài khoản / ID ví / số điện thoại ví" name="number" maxLength={64} required autoComplete="off" inputMode="text"
        hint="KHÔNG nhập số thẻ, mật khẩu, mã OTP hay PIN." />
      <div className="sm:col-span-2">
        <Field label="Ghi chú cho người chuyển (không bắt buộc)" name="note" maxLength={200} hint="Ví dụ: Ngân hàng, chi nhánh, nội dung chuyển khoản." />
      </div>
      <div className="sm:col-span-2"><SubmitButton pendingText="Đang mã hóa…">Lưu (mã hóa)</SubmitButton></div>
    </form>
  );
}
