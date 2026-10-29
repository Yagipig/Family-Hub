import { LOTO_HIT_STYLE } from "@/components/LotoBall";

/** Luoi to lo to chi de XEM (khong bam duoc): dung cho xem truoc bang tinh va bang cua nguoi thang. So da ho dong con dau do kieu bingo. */
export function LotoGridView({ grid, called, compact }: { grid: number[]; called?: number[]; compact?: boolean }) {
  const set = new Set(called ?? []);
  return (
    <div role="grid" aria-label="Bảng lô tô" className={`grid grid-cols-9 ${compact ? "gap-0.5" : "gap-1"}`}>
      {Array.from({ length: 27 }, (_, i) => {
        const v = grid[i] ?? 0;
        if (v === 0) {
          return <div key={i} role="gridcell" aria-hidden className="aspect-square rounded-md bg-purple-200/40" />;
        }
        const hit = set.has(v);
        return (
          <div
            key={i}
            role="gridcell"
            aria-label={`Số ${v}${hit ? ", đã hô" : ""}`}
            style={hit ? LOTO_HIT_STYLE : undefined}
            className={`flex aspect-square items-center justify-center rounded-full font-black ${
              compact ? "text-sm sm:text-base" : "min-h-11 text-lg sm:text-xl"
            } ${hit ? "text-white" : "bg-white text-ink shadow-sm ring-1 ring-[#e7ddc8]"}`}
          >
            {v}
          </div>
        );
      })}
    </div>
  );
}
