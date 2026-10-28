"use client";
import { useActionState } from "react";
import { updateProfile } from "./actions";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="ok">{state.ok}</Alert>}
      <Field label="Tên hiển thị" name="displayName" defaultValue={displayName} required maxLength={120} />
      <SubmitButton>Lưu</SubmitButton>
    </form>
  );
}
