import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";

async function coverUrl(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("families").select("cover_path").eq("id", session.familyId).maybeSingle();
  return signedUrl("family-media", data?.cover_path as string | null | undefined);
}

/**
 * Ảnh bìa gia đình làm dải đầu trang cho MỌI thành viên (URL đã ký, bucket private). Chưa có ảnh bìa: dải màu đỏ rượu.
 * Dùng: <FamilyCover><h1>…</h1></FamilyCover>
 */
export async function FamilyCover({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  const url = await coverUrl();
  return (
    <div className={`relative isolate overflow-hidden rounded-2xl bg-wine text-white ${className}`}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" aria-hidden="true" decoding="async" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      )}
      <div className={`px-6 py-8 sm:py-12 ${url ? "bg-gradient-to-t from-wine-dark/80 via-wine-dark/30 to-transparent" : ""}`}>{children}</div>
    </div>
  );
}

/**
 * Ảnh bìa làm nền mờ toàn trang (rất nhạt, không bắt chuột). Đặt một lần trong layout của khu vực đã đăng nhập:
 * <FamilyCoverBackdrop /> ngay đầu <div className="min-h-dvh">. Gia đình chưa đặt ảnh bìa riêng thì dùng
 * ảnh hoàng hôn mặc định /sunset-sky.jpg (người dùng chọn 31/10/2026: cảnh hoàng hôn trên mặt nước, không bóng người).
 */
export async function FamilyCoverBackdrop() {
  const url = (await coverUrl()) ?? "/sunset-sky.jpg";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" aria-hidden="true" decoding="async" loading="lazy"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full scale-110 object-cover opacity-[0.16] blur-md" />
  );
}
