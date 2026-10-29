/** Luoi to lo to chi de XEM (khong bam duoc): dung cho xem truoc bang tinh va bang cua nguoi thang. */
export function LotoGridView({ grid, called, compact }: { grid: number[]; called?: number[]; compact?: boolean }) {
  const set = new Set(called ?? []);
  return (
    <div role="grid" aria-label="Bảng lô tô" className={`grid grid-cols-9 ${compact ? "gap-0.5" : "gap-1"}`}>
      {Array.from({ length: 27 }, (_, i) => {
        const v = grid[i] ?? 0;
        if (v === 0) {
          return <div key={i} role="gridcell" aria-hidden className="aspect-square rounded-md bg-champagne/30" />;
        }
        const hit = set.has(v);
        return (
          <div
            key={i}
            role="gridcell"
            aria-label={`Số ${v}${hit ? ", đã hô" : ""}`}
            className={`flex aspect-square items-center justify-center rounded-md font-bold ${
              compact ? "text-sm sm:text-base" : "min-h-11 text-lg sm:text-xl"
            } ${hit ? "bg-wine text-white" : "bg-white text-ink ring-1 ring-ink-soft/30"}`}
          >
            {v}
          </div>
        );
      })}
    </div>
  );
}
