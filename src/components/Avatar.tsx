import { initials } from "@/lib/members-text";
import type { Gender } from "@/lib/members-types";

const TONE: Record<string, string> = {
  male: "bg-[#dde6ef] text-[#2a4766] border-[#9db3c9]",
  female: "bg-[#f7dfe3] text-wine border-[#d9a3ad]",
  other: "bg-champagne-soft text-ink border-champagne",
};

/**
 * Ảnh đại diện: hiện ảnh nếu có `src` (URL do module media cấp), nếu chưa có thì hiện chữ cái đầu.
 * Tên luôn được hiển thị ở nơi dùng nên ảnh/chữ cái là trang trí (aria-hidden / alt rỗng).
 */
export function Avatar({ name, src, size = 56, gender, className = "" }: {
  name: string; src?: string | null; size?: number; gender?: Gender | null; className?: string;
}) {
  const box = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async"
      className={`shrink-0 rounded-full border border-champagne object-cover ${className}`} style={box} />;
  }
  return (
    <span aria-hidden="true" style={{ ...box, fontSize: Math.max(12, Math.round(size * 0.38)) }}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full border font-bold ${TONE[gender ?? "other"]} ${className}`}>
      {initials(name)}
    </span>
  );
}
