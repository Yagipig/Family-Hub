"use client";
import Link from "next/link";
import { memo, useMemo } from "react";
import { Avatar } from "@/components/Avatar";
import { buildOutline, type FamilyIndex } from "@/lib/family-graph";
import { foldVietnamese, lifeSpan, PARENT_KIND_LABELS, PARTNER_STATUS_LABELS } from "@/lib/members-text";

/**
 * Chế độ danh sách (dễ truy cập): cây thụt lề theo đời, đọc được bằng trình đọc màn hình và bàn phím.
 * Mỗi người xuất hiện một lần; vợ/chồng ghi cạnh người kia.
 */
export const FamilyOutline = memo(function FamilyOutline({ index, gens, query, highlightId, onShowInDiagram }: {
  index: FamilyIndex; gens: Map<string, number>; query: string; highlightId: string | null; onShowInDiagram: (id: string) => void;
}) {
  const items = useMemo(() => buildOutline(index), [index]);
  const needle = foldVietnamese(query);
  const shown = useMemo(() => {
    if (!needle) return items;
    return items.filter((it) => {
      const names = [index.people.get(it.id)?.name ?? "", ...it.spouses.map((s) => index.people.get(s.id)?.name ?? "")];
      return names.some((n) => foldVietnamese(n).includes(needle));
    });
  }, [items, needle, index]);

  return (
    <div>
      <p className="mb-3 text-base text-ink-soft" aria-live="polite">
        {needle ? `Tìm thấy ${shown.length} dòng.` : `${index.people.size} người, xếp theo đời. Mỗi bậc thụt vào là một đời con cháu.`}
      </p>
      <ul className="space-y-1" aria-label="Danh sách gia phả theo đời">
        {shown.map((it) => {
          const p = index.people.get(it.id)!;
          const g = p.gen ?? gens.get(it.id);
          return (
            <li key={it.id} id={`o-${it.id}`}
              style={{ marginLeft: needle ? 0 : Math.min(it.depth, 12) * 22 }}
              className={`rounded-xl border bg-ivory p-3 ${highlightId === it.id ? "border-wine ring-2 ring-champagne" : "border-champagne/50"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={p.name} src={p.avatar} gender={p.gender} size={44} />
                <div className="min-w-[11rem] flex-1 basis-48">
                  <Link href={`/thanh-vien/${p.id}`} className="text-lg font-bold text-wine underline-offset-2 hover:underline">{p.name}</Link>
                  {p.dead && <span className="ml-2 text-sm text-ink-soft">(đã mất)</span>}
                  <p className="text-sm text-ink-soft">
                    {[g ? `Đời ${g}` : null, lifeSpan(p.by, p.dy, p.dead) || null, it.kind && it.kind !== "biological" ? `Con ${PARENT_KIND_LABELS[it.kind]}` : null]
                      .filter(Boolean).join(" · ")}
                  </p>
                  {it.spouses.length > 0 && (
                    <p className="text-base">
                      {it.spouses.map((s, i) => {
                        const sp = index.people.get(s.id);
                        return (
                          <span key={s.id}>
                            {i > 0 && "; "}
                            Vợ/chồng: <Link href={`/thanh-vien/${s.id}`} className="font-semibold text-wine underline-offset-2 hover:underline">{sp?.name ?? "(không xem được)"}</Link>
                            <span className="text-sm text-ink-soft"> ({PARTNER_STATUS_LABELS[s.status].toLowerCase()}{s.shownHere ? "" : "; xem ở dòng riêng"})</span>
                          </span>
                        );
                      })}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => onShowInDiagram(it.id)}
                  className="min-h-12 rounded-xl border border-wine px-4 text-base font-semibold text-wine hover:bg-champagne-soft">
                  Xem trên sơ đồ<span className="sr-only"> của {p.name}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
