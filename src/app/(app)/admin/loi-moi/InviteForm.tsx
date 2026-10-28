"use client";
import { useActionState, useState } from "react";
import { createInvitation } from "./actions";
import { Alert, Field, SelectField, buttonGhostClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function InviteForm({ branches, isSuperAdmin }: { branches: { id: string; name: string }[]; isSuperAdmin: boolean }) {
  const [state, action] = useActionState(createInvitation, null);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="ok">{state.ok}</Alert>}
      {state?.link && (
        <div className="space-y-2">
          <input readOnly value={state.link} aria-label="Liên kết mời" className="block w-full min-h-12 rounded-xl border border-champagne bg-champagne-soft px-4 text-base" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className={buttonGhostClass}
            onClick={async () => { await navigator.clipboard.writeText(state.link!); setCopied(true); }}>
            {copied ? "Đã sao chép" : "Sao chép liên kết"}
          </button>
          <p className="text-sm text-ink-soft">Liên kết này chỉ hiện một lần. Nếu mất, hãy thu hồi và tạo lời mời mới.</p>
        </div>
      )}
      <Field label="Email người được mời (để trống nếu chỉ dùng liên kết)" name="email" type="email" maxLength={254} />
      <SelectField label="Vai trò" name="role" defaultValue="member">
        <option value="member">Thành viên</option>
        <option value="guest">Khách (chỉ xem)</option>
        {isSuperAdmin && <option value="branch_admin">Quản trị nhánh (chọn nhánh bên dưới)</option>}
        {isSuperAdmin && <option value="family_admin">Quản trị gia đình</option>}
      </SelectField>
      <SelectField label="Nhánh họ (bắt buộc với Quản trị nhánh)" name="branchId" defaultValue="">
        <option value="">— Không chọn —</option>
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </SelectField>
      <SelectField label="Hiệu lực" name="ttlHours" defaultValue="168">
        <option value="24">1 ngày</option>
        <option value="72">3 ngày</option>
        <option value="168">7 ngày</option>
        <option value="720">30 ngày</option>
      </SelectField>
      <SubmitButton>Tạo lời mời</SubmitButton>
    </form>
  );
}
