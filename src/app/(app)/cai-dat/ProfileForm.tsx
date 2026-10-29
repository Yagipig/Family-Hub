"use client";
import { useActionState } from "react";
import { updateProfile } from "./actions";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function ProfileForm({ displayName, aliasName }: { displayName: string; aliasName?: string | null }) {
  const [state, action] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="ok">{state.ok}</Alert>}
      <Field label="Tên hiển thị" name="displayName" defaultValue={displayName} required maxLength={120} />
      <Field label="Tên gọi khác (tên ở nhà, biệt danh)" name="aliasName" defaultValue={aliasName ?? ""} maxLength={80} autoComplete="off"
        hint="Nếu có, tên này sẽ được ưu tiên hiển thị thay cho tên hiển thị trong trò chuyện, bảng tin và trò chơi." />
      <SubmitButton>Lưu</SubmitButton>
    </form>
  );
}
