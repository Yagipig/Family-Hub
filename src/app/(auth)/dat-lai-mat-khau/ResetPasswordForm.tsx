"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema } from "@/lib/schemas";
import { Alert, Card } from "@/components/ui";
import { PasswordField } from "@/components/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";

type Phase = "checking" | "ready" | "invalid" | "done";

/**
 * Trang dat mat khau moi khi nguoi dung bam lien ket trong email quen mat khau.
 * Lien ket mo ra kem ma phien khoi phuc (PKCE ?code=...) — trang nay doi ma lay phien
 * roi goi updateUser. Khong co phien hop le thi bao lien ket het han.
 */
export function ResetPasswordForm() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;
    const ready = () => { if (!settled) { settled = true; setPhase("ready"); } };
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") ready();
    });
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) { ready(); return; }
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (!exErr) { ready(); return; }
      }
      window.setTimeout(async () => {
        if (settled) return;
        const { data: d2 } = await supabase.auth.getSession();
        if (d2.session) ready();
        else { settled = true; setPhase("invalid"); }
      }, 1200);
    })();
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const parsed = resetPasswordSchema.safeParse({
      password: fd.get("password"),
      confirmPassword: fd.get("confirmPassword"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: upErr } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (upErr) {
      setBusy(false);
      setError(/password should/i.test(upErr.message) || /weak/i.test(upErr.message)
        ? "Mật khẩu chưa đạt yêu cầu: cần ít nhất 1 chữ thường, 1 chữ HOA và 1 chữ số (ví dụ: Matkhau123)."
        : "Không đặt được mật khẩu mới. Liên kết có thể đã hết hạn — hãy quay lại trang Quên mật khẩu để gửi lại.");
      return;
    }
    await supabase.auth.signOut();
    setBusy(false);
    setPhase("done");
  }

  return (
    <Card>
      {phase === "checking" && <p className="text-lg">Đang kiểm tra liên kết đặt lại mật khẩu…</p>}
      {phase === "invalid" && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Liên kết đã hết hạn hoặc không hợp lệ</h2>
          <p className="text-base text-ink-soft">
            Liên kết đặt lại mật khẩu chỉ dùng được một lần và trong thời gian ngắn. Hãy yêu cầu gửi lại liên kết mới.
          </p>
          <Link href="/quen-mat-khau" className="font-semibold text-wine underline">Tới trang Quên mật khẩu</Link>
        </div>
      )}
      {phase === "done" && (
        <div className="space-y-3">
          <Alert kind="ok">Đã đặt mật khẩu mới thành công!</Alert>
          <p className="text-base text-ink-soft">Hãy đăng nhập lại bằng mật khẩu mới vừa đặt.</p>
          <Link href="/dang-nhap" className="font-semibold text-wine underline">Tới trang Đăng nhập</Link>
        </div>
      )}
      {phase === "ready" && (
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 className="text-xl font-bold">Đặt mật khẩu mới</h2>
          {error && <Alert kind="error">{error}</Alert>}
          <PasswordField label="Mật khẩu mới (ít nhất 10 ký tự)" name="password" autoComplete="new-password" required minLength={10}
            hint="Cần có chữ thường, chữ HOA và chữ số — ví dụ: Matkhau123." />
          <PasswordField label="Nhập lại mật khẩu mới" name="confirmPassword" autoComplete="new-password" required minLength={10} />
          <SubmitButton pendingText={busy ? "Đang lưu…" : undefined}>Lưu mật khẩu mới</SubmitButton>
        </form>
      )}
    </Card>
  );
}
