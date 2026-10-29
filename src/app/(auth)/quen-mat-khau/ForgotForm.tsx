"use client";
import { useActionState } from "react";
import Link from "next/link";
import { sendReset } from "./actions";
import { Alert, Card, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function ForgotForm() {
  const [state, action] = useActionState(sendReset, null);
  return (
    <Card>
      <form action={action} className="space-y-4">
        <h2 className="text-xl font-bold">Quên mật khẩu</h2>
        <p className="text-base text-ink-soft">
          Nhập email bạn đã dùng để đăng ký. Hệ thống sẽ gửi một liên kết đặt lại mật khẩu vào hộp thư của bạn.
        </p>
        {state?.error && <Alert kind="error">{state.error}</Alert>}
        {state?.ok ? (
          <Alert kind="ok">{state.ok}</Alert>
        ) : (
          <>
            <Field label="Email" name="email" type="email" autoComplete="email" required />
            <SubmitButton pendingText="Đang gửi…">Gửi liên kết đặt lại mật khẩu</SubmitButton>
          </>
        )}
        <p className="text-sm text-ink-soft">
          Nhớ ra mật khẩu rồi? <Link href="/dang-nhap" className="font-semibold text-wine underline">Quay lại đăng nhập</Link>
        </p>
      </form>
    </Card>
  );
}
