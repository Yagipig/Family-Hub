"use client";
import { useId, useMemo, useState } from "react";
import { foldVietnamese } from "@/lib/members-text";
import type { PickerMember } from "@/lib/members-types";

/**
 * Ô chọn một thành viên có sẵn: gõ tên (không cần dấu) -> bấm vào kết quả. Giá trị gửi đi là mã (id) trong ô ẩn.
 * Danh sách đã được máy chủ lọc theo quyền xem; việc kiểm tra thật vẫn do RPC thực hiện.
 */
export function MemberPicker({ name, label, members, excludeIds = [], hint = "Gõ một phần tên để tìm." }: {
  name: string; label: string; members: PickerMember[]; excludeIds?: string[]; hint?: string;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<PickerMember | null>(null);
  const folded = useMemo(() => members.map((m) => ({ m, key: foldVietnamese(`${m.name} ${m.nick ?? ""} ${m.alt ?? ""}`) })), [members]);
  const exclude = useMemo(() => new Set(excludeIds), [excludeIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const matches = useMemo(() => {
    const needle = foldVietnamese(q);
    if (!needle) return [];
    const out: PickerMember[] = [];
    for (const f of folded) {
      if (exclude.has(f.m.id) || !f.key.includes(needle)) continue;
      out.push(f.m);
      if (out.length >= 30) break;
    }
    return out;
  }, [q, folded, exclude]);

  const describe = (m: PickerMember) => [m.name, m.by ? `sinh ${m.by}` : null, m.branch ? `nhánh ${m.branch}` : null].filter(Boolean).join(" · ");

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={chosen?.id ?? ""} />
      {chosen ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ok bg-green-50 px-4 py-3">
          <span className="text-base font-semibold">{label}: {describe(chosen)}</span>
          <button type="button" onClick={() => { setChosen(null); setQ(""); }}
            className="min-h-12 rounded-xl border border-wine px-4 text-base font-semibold text-wine hover:bg-champagne-soft">Chọn người khác</button>
        </div>
      ) : (
        <>
          <label htmlFor={id} className="block text-base font-semibold">{label}</label>
          <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" aria-describedby={`${id}-hint`}
            className="block min-h-12 w-full rounded-xl border border-ink-soft/40 bg-white px-4 py-2 text-base text-ink" />
          <p id={`${id}-hint`} className="text-sm text-ink-soft">{hint}</p>
          {q.trim() !== "" && (
            <div aria-live="polite">
              {matches.length === 0 ? (
                <p className="text-base text-ink-soft">Không tìm thấy ai phù hợp.</p>
              ) : (
                <ul className="max-h-72 divide-y divide-champagne/50 overflow-auto rounded-xl border border-champagne/60 bg-white">
                  {matches.map((m) => (
                    <li key={m.id}>
                      <button type="button" onClick={() => setChosen(m)}
                        className="block min-h-12 w-full px-4 py-3 text-left text-base hover:bg-champagne-soft focus-visible:bg-champagne-soft">
                        {describe(m)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
