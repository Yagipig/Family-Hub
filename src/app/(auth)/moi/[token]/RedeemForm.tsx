"use client";
import { useActionState } from "react";
import { redeem } from "./actions";
import { Alert, Card, Field } from "@/components/ui";
import { PasswordField } from "@/components/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";

export function RedeemForm({ token, familyName, roleLabel, lockedEmail }: {
  token: string; familyName: string; roleLabel: string; lockedEmail: string | null;
}) {
  const [state, action] = useActionState(redeem, null);
  return (
    <Card>
      <form action={action} className="space-y-4">
        <h2 className="text-xl font-bold">Bạn được mời vào “{familyName}”</h2>
        <p className="text-base text-ink-soft">Vai trò: <strong>{roleLabel}</strong></p>
        {state?.error && <Alert kind="error">{state.error}</Alert>}
        <input type="hidden" name="token" value={token} />
        <Field label="Tên hiển thị" name="displayName" autoComplete="name" required maxLength={120} />
        <Field label="Email" name="email" type="email" autoComplete="email" required
          defaultValue={lockedEmail ?? ""} readOnly={!!lockedEmail}
          hint={lockedEmail ? "Lời mời này dành riêng cho email trên." : undefined} />
        <PasswordField label="Mật khẩu (ít nhất 10 ký tự)" name="password" autoComplete="new-password" required minLength={10} />
        <PasswordField label="Nhập lại mật khẩu" name="confirmPassword" autoComplete="new-password" required minLength={10} />
        <SubmitButton pendingText="Đang tạo tài khoản…">Tham gia gia đình</SubmitButton>
      </form>
    </Card>
  );
}
