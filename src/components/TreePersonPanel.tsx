"use client";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { moveSiblingAction } from "@/app/(app)/gia-pha/actions";
import { partnerIds, siblingsOf, type FamilyIndex } from "@/lib/family-graph";
import { ageText, formatLunar, formatSolar, GENDER_LABELS, lifeSpan, PARENT_KIND_LABELS } from "@/lib/members-text";

/** Ngăn chi tiết khi chọn một người trên sơ đồ: ngăn kéo ở dưới màn hình điện thoại, cột bên cạnh trên máy tính. */
export function TreePersonPanel({ id, index, gens, branchName, canEdit, canArrange = false, open, onToggle, onClose, onFocus }: {
  id: string; index: FamilyIndex; gens: Map<string, number>; branchName: string | null; canEdit: boolean; canArrange?: boolean;
  open: boolean; onToggle: () => void; onClose: () => void; onFocus: (id: string) => void;
}) {
  const p = index.people.get(id);
  if (!p) return null;
  const parents = (index.parentsOf.get(id) ?? []).map((l) => ({ id: l.parent, kind: l.kind }));
  const children = (index.childrenOf.get(id) ?? []).map((l) => ({ id: l.child, kind: l.kind }));
  const partners = partnerIds(index, id);
  const siblings = siblingsOf(index, id);
  const gen = p.gen ?? gens.get(id);
  const age = ageText(p.by, p.dy, p.dead);

  // Toàn bộ thông tin đã điền (các trường bị che theo quyền riêng tư đã là null ở dữ liệu nạp vào)
  const birthSolar = formatSolar(p.by, p.bm ?? null, p.bd ?? null);
  const birthLunar = formatLunar(p.ly ?? null, p.lm ?? null, p.ld ?? null, p.lleap ?? false);
  const deathSolar = p.dead || p.dy != null ? formatSolar(p.dy, p.dm ?? null, p.dd ?? null) : null;
  const deathLunar = p.dead ? formatLunar(null, p.dlm ?? null, p.dld ?? null, p.dleap ?? false) : null;
  const infoRows: { label: string; value: string }[] = [
    ...(birthSolar ? [{ label: "Sinh (dương lịch)", value: birthSolar }] : []),
    ...(birthLunar ? [{ label: "Sinh (âm lịch)", value: birthLunar }] : []),
    ...(deathSolar ? [{ label: "Mất (dương lịch)", value: deathSolar }] : []),
    ...(deathLunar ? [{ label: "Mất (âm lịch)", value: deathLunar }] : []),
    ...(p.hometown ? [{ label: "Quê quán", value: p.hometown }] : []),
    ...(p.genTitle ? [{ label: "Tên đời / bối", value: p.genTitle }] : []),
    ...(p.phone ? [{ label: "Điện thoại", value: p.phone }] : []),
    ...(p.email ? [{ label: "Email", value: p.email }] : []),
  ];

  const group = (title: string, ids: { id: string; note?: string }[]) => ids.length === 0 ? null : (
    <div>
      <h3 className="text-base font-bold text-ink-soft">{title}</h3>
      <ul className="mt-1 flex flex-wrap gap-2">
        {ids.map((x) => (
          <li key={x.id}>
            <button type="button" onClick={() => onFocus(x.id)}
              className="min-h-12 rounded-xl border border-champagne bg-white px-3 text-left text-base hover:bg-champagne-soft">
              {index.people.get(x.id)?.name ?? "—"}{x.note ? <span className="text-sm text-ink-soft"> ({x.note})</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <aside aria-label={`Chi tiết: ${p.name}`}
      className="fixed inset-x-0 bottom-0 z-40 max-h-[65dvh] overflow-y-auto rounded-t-2xl border-t-4 border-champagne bg-ivory p-4 shadow-2xl md:static md:z-auto md:max-h-none md:w-80 md:shrink-0 md:self-start md:rounded-2xl md:border md:border-champagne/60 md:shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar name={p.name} src={p.avatar} gender={p.gender} size={56} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold leading-tight text-wine">{p.name}</h2>
          {p.nick && <p className="text-sm text-ink-soft">Thường gọi: {p.nick}</p>}
          <p className="text-sm text-ink-soft">{[lifeSpan(p.by, p.dy, p.dead), age].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" onClick={onToggle} aria-expanded={open}
          className="min-h-12 rounded-xl border border-wine px-3 text-base font-semibold text-wine md:hidden">{open ? "Thu gọn" : "Mở rộng"}</button>
        <button type="button" onClick={onClose} aria-label="Đóng ngăn chi tiết"
          className="min-h-12 min-w-12 rounded-xl border border-ink-soft/40 text-lg font-bold text-ink-soft hover:bg-champagne-soft">✕</button>
      </div>
      <div className={`${open ? "mt-4 space-y-4" : "hidden md:mt-4 md:block md:space-y-4"}`}>
        <p className="flex flex-wrap gap-2 text-base">
          {p.gender && <span className="rounded-lg bg-champagne-soft px-3 py-1">{GENDER_LABELS[p.gender]}</span>}
          {gen != null && <span className="rounded-lg bg-champagne-soft px-3 py-1">Đời {gen}</span>}
          {branchName && <span className="rounded-lg bg-champagne-soft px-3 py-1">Nhánh {branchName}</span>}
          {p.dead && <span className="rounded-lg bg-champagne-soft px-3 py-1">Đã mất</span>}
        </p>
        {infoRows.length > 0 && (
          <div>
            <h3 className="text-base font-bold text-ink-soft">Thông tin</h3>
            <dl className="mt-1 space-y-1 text-base">
              {infoRows.map((r) => (
                <div key={r.label} className="flex gap-2">
                  <dt className="w-32 shrink-0 text-ink-soft">{r.label}</dt>
                  <dd className="min-w-0 font-medium">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {p.bio && (
          <div>
            <h3 className="text-base font-bold text-ink-soft">Tiểu sử</h3>
            <p className="mt-1 whitespace-pre-line text-base">{p.bio}</p>
          </div>
        )}
        <Link href={`/thanh-vien/${id}`}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-wine px-5 text-base font-semibold text-white hover:bg-wine-dark">Mở hồ sơ đầy đủ</Link>
        {canArrange && siblings.length > 0 && (
          <div className="border-t border-champagne/60 pt-3">
            <h3 className="text-base font-bold text-ink-soft">Thứ tự anh chị em (admin sắp xếp)</h3>
            <p className="mt-0.5 text-sm text-ink-soft">Dời người này trong nhóm anh chị em cùng cha mẹ — cây sẽ xếp lại từ lớn đến nhỏ theo thứ tự này.</p>
            <div className="mt-2 flex gap-2">
              <form action={moveSiblingAction} className="flex-1">
                <input type="hidden" name="memberId" value={id} />
                <input type="hidden" name="dir" value="-1" />
                <button type="submit" className="min-h-12 w-full rounded-xl border border-wine px-3 font-semibold text-wine hover:bg-champagne-soft">◀ Lên trước</button>
              </form>
              <form action={moveSiblingAction} className="flex-1">
                <input type="hidden" name="memberId" value={id} />
                <input type="hidden" name="dir" value="1" />
                <button type="submit" className="min-h-12 w-full rounded-xl border border-wine px-3 font-semibold text-wine hover:bg-champagne-soft">Xuống sau ▶</button>
              </form>
            </div>
          </div>
        )}
        {group("Cha mẹ", parents.map((x) => ({ id: x.id, note: x.kind === "biological" ? undefined : PARENT_KIND_LABELS[x.kind] })))}
        {group("Vợ / chồng", partners.map((x) => ({ id: x })))}
        {group("Con", children.map((x) => ({ id: x.id, note: x.kind === "biological" ? undefined : PARENT_KIND_LABELS[x.kind] })))}
        {group("Anh chị em", siblings.map((x) => ({ id: x.id, note: x.full ? undefined : "cùng cha hoặc mẹ" })))}
        {canEdit && (
          <div className="flex flex-wrap gap-2 border-t border-champagne/60 pt-3 text-base">
            <Link className="min-h-12 flex-1 rounded-xl border border-wine px-3 py-3 text-center font-semibold text-wine hover:bg-champagne-soft" href={`/thanh-vien/moi?rel=child&to=${id}`}>Thêm con</Link>
            <Link className="min-h-12 flex-1 rounded-xl border border-wine px-3 py-3 text-center font-semibold text-wine hover:bg-champagne-soft" href={`/thanh-vien/moi?rel=partner&to=${id}`}>Thêm vợ/chồng</Link>
          </div>
        )}
      </div>
    </aside>
  );
}
