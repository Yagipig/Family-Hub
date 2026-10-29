import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { GENDER_LABELS, lifeSpan } from "@/lib/members-text";
import type { Gender } from "@/lib/members-types";

export type MemberCardData = {
  id: string; full_name: string; nickname: string | null; alt_names?: string | null; gender: Gender | null; avatar: string | null;
  birth_solar_year: number | null; death_solar_year: number | null; is_deceased: boolean;
  hometown: string | null; branchName: string | null; generation_no: number | null;
};

/** Thẻ thành viên lớn, dễ đọc; cả thẻ là một liên kết (vùng bấm rộng). */
export function MemberCard({ m }: { m: MemberCardData }) {
  const span = lifeSpan(m.birth_solar_year, m.death_solar_year, m.is_deceased);
  return (
    <Link href={`/thanh-vien/${m.id}`}
      className="flex min-h-24 items-center gap-4 rounded-2xl border border-champagne/60 bg-ivory p-4 shadow-sm hover:border-wine focus-visible:border-wine">
      <Avatar name={m.full_name} src={m.avatar} gender={m.gender} size={64} />
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold leading-snug text-ink">
          {m.full_name}
          {m.is_deceased && <span className="ml-2 rounded-md bg-champagne-soft px-2 py-0.5 align-middle text-sm font-semibold text-ink-soft">Đã mất</span>}
        </span>
        {m.nickname && <span className="block text-base text-ink-soft">Thường gọi: {m.nickname}</span>}
        {m.alt_names && <span className="block text-base text-ink-soft">Tên khác: {m.alt_names}</span>}
        <span className="block text-base text-ink-soft">
          {[m.gender ? GENDER_LABELS[m.gender] : null, span || null, m.generation_no ? `Đời ${m.generation_no}` : null].filter(Boolean).join(" · ")}
        </span>
        {(m.branchName || m.hometown) && (
          <span className="block truncate text-sm text-ink-soft">
            {[m.branchName ? `Nhánh ${m.branchName}` : null, m.hometown ? `Quê ${m.hometown}` : null].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
    </Link>
  );
}
