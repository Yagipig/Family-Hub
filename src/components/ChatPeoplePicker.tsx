"use client";
import { useMemo, useState } from "react";
import { normalizeSearch } from "@/lib/chat-text";

type Person = { user_id: string; display_name: string; branch_name: string | null };

/**
 * Danh sách chọn thành viên cho nhóm: ô lọc theo tên (không cần gõ dấu) + hộp chọn lớn.
 * Các hộp chọn bị lọc ẩn vẫn được gửi đi (chỉ ẩn bằng CSS), nên lọc không làm mất lựa chọn.
 */
export function ChatPeoplePicker({ people, name = "members" }: { people: Person[]; name?: string }) {
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const needle = normalizeSearch(q);
  const shown = useMemo(
    () => new Set(people.filter((p) => !needle || normalizeSearch(`${p.display_name} ${p.branch_name ?? ""}`).includes(needle)).map((p) => p.user_id)),
    [people, needle],
  );
  return (
    <div className="space-y-3">
      <label className="block text-base font-semibold">
        Lọc danh sách
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Gõ tên để tìm…"
          className="mt-1 block min-h-12 w-full rounded-xl border border-ink-soft/40 bg-white px-4 py-2 text-base font-normal text-ink"
        />
      </label>
      <p className="text-base text-ink-soft" role="status">Đã chọn {checked.size} người.</p>
      <fieldset className="max-h-96 space-y-2 overflow-y-auto rounded-xl border border-champagne/60 bg-white p-3">
        <legend className="px-1 text-base font-semibold">Chọn thành viên vào nhóm</legend>
        {people.length === 0 && <p className="text-base text-ink-soft">Chưa có ai khác để chọn.</p>}
        {people.map((p) => (
          <label
            key={p.user_id}
            className={`${shown.has(p.user_id) ? "flex" : "hidden"} min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 py-1 text-lg hover:bg-champagne-soft`}
          >
            <input
              type="checkbox"
              name={name}
              value={p.user_id}
              checked={checked.has(p.user_id)}
              onChange={(e) =>
                setChecked((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(p.user_id);
                  else next.delete(p.user_id);
                  return next;
                })
              }
              className="h-6 w-6 accent-[var(--color-wine)]"
            />
            <span>
              {p.display_name}
              {p.branch_name && <span className="ml-2 text-base text-ink-soft">({p.branch_name})</span>}
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
