"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Alert, Card, Field, buttonClass } from "@/components/ui";

type Enrollment = { factorId: string; qr: string; secret: string };

/**
 * mode = "enroll": đăng ký ứng dụng xác thực (TOTP) lần đầu.
 * mode = "challenge": nhập mã 6 số để nâng phiên lên aal2.
 */
export function MfaPanel({ mode, next }: { mode: "enroll" | "challenge"; next: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasFactor, setHasFactor] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp?.[0];
      setHasFactor(!!verified);
      if (verified) setFactorId(verified.id);
    });
  }, []);

  async function startEnroll() {
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Family Hub ${Date.now()}` });
    if (error || !data) return setError("Không bắt đầu được việc thiết lập. Vui lòng thử lại.");
    setFactorId(data.id);
    setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (error) return setError("Mã chưa đúng hoặc đã hết hạn. Hãy nhập mã mới từ ứng dụng.");
    router.replace(next);
    router.refresh();
  }

  if (hasFactor === null) return <Card><p>Đang tải…</p></Card>;

  if (mode === "enroll" && !hasFactor && !enrollment) {
    return (
      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Bật xác thực hai lớp</h2>
        <p className="text-base">
          Tài khoản quản trị bắt buộc dùng ứng dụng xác thực (Google Authenticator, Microsoft Authenticator…).
        </p>
        {error && <Alert kind="error">{error}</Alert>}
        <button className={buttonClass} onClick={startEnroll}>Bắt đầu thiết lập</button>
      </Card>
    );
  }

  if (mode === "enroll" && hasFactor && !enrollment) {
    return <Card><Alert kind="ok">Xác thực hai lớp đã được bật cho tài khoản này.</Alert></Card>;
  }

  return (
    <Card>
      <form onSubmit={verify} className="space-y-4">
        <h2 className="text-xl font-bold">{enrollment ? "Quét mã và nhập mã 6 số" : "Nhập mã xác thực"}</h2>
        {enrollment && (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qr} alt="Mã QR để thêm tài khoản vào ứng dụng xác thực" className="mx-auto h-48 w-48" />
            <p className="break-all text-sm text-ink-soft">Không quét được? Nhập khóa này: <code>{enrollment.secret}</code></p>
          </div>
        )}
        {error && <Alert kind="error">{error}</Alert>}
        <Field label="Mã 6 số" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
          value={code} onChange={(e) => setCode(e.target.value)} required />
        <button type="submit" disabled={busy} className={buttonClass}>{busy ? "Đang kiểm tra…" : "Xác nhận"}</button>
      </form>
    </Card>
  );
}
