"use client";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui";

export function SubmitButton({ children, pendingText = "Đang xử lý…" }: { children: React.ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Nút nhỏ cần xác nhận trước khi gửi form (ví dụ thu hồi quyền). */
export function ConfirmButton({ children, message, className }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
