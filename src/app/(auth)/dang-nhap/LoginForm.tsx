"use client";
import { useActionState } from "react";
import { login } from "./actions";
import { Alert, Card, Field } from "@/components/ui";
import { PasswordField } from "@/components/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm() {
  const [state, action] = useActionState(login, null);
  return (
    <Card>
      <form action={action} className="space-y-4">
        <h2 className="text-xl font-bold">Đăng nhập</h2>
        {state?.error && <Alert kind="error">{state.error}</Alert>}
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <PasswordField label="Mật khẩu" name="password" autoComplete="current-password" required />
        <SubmitButton pendingText="Đang đăng nhập…">Đăng nhập</SubmitButton>
        <p className="text-sm text-ink-soft">
          Đây là trang riêng tư của gia đình. Nếu chưa có tài khoản, hãy mở liên kết mời mà
          gia đình đã chia sẻ với bạn để đăng ký tham gia.
        </p>
      </form>
    </Card>
  );
}
