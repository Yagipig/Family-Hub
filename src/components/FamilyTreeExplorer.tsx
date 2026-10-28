"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { FamilyOutline } from "@/components/FamilyOutline";
import { TreePersonPanel } from "@/components/TreePersonPanel";
import {
  branchWithDescendants, buildElements, buildIndex, buildOutline, computeGenerations, filterByBranch, searchPeople,
} from "@/lib/family-graph";
import { layoutGraph, type Direction } from "@/lib/family-layout";
import { branchColor, lifeSpan } from "@/lib/members-text";
import type { BranchRow, TreeLink, TreePartner, TreePerson } from "@/lib/members-types";

const FamilyFlow = dynamic(() => import("@/components/FamilyFlow").then((m) => m.FamilyFlow), {
  ssr: false,
  loading: () => <p className="p-6 text-base text-ink-soft" role="status">Đang tải sơ đồ…</p>,
});

type Mode = "diagram" | "list";
const seg = (active: boolean) =>
  `min-h-12 px-5 text-base font-semibold first:rounded-l-xl last:rounded-r-xl border border-wine ${active ? "bg-wine text-white" : "bg-ivory text-wine hover:bg-champagne-soft"}`;

export function FamilyTreeExplorer({ people, links, partners, branches, initialFocusId, selfId, canEdit }: {
  people: TreePerson[]; links: TreeLink[]; partners: TreePartner[]; branches: BranchRow[];
  initialFocusId: string | null; selfId: string | null; canEdit: boolean;
}) {
  const [mode, setMode] = useState<Mode>("diagram");
  const [direction, setDirection] = useState<Direction>("TB");
  const [branch, setBranch] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialFocusId);
  // Ngăn kéo trên điện thoại mặc định thu gọn (chỉ hiện tiêu đề) để không che sơ đồ; chạm vào một người sẽ mở ra
  const [panelOpen, setPanelOpen] = useState(false);
  const [showOpts, setShowOpts] = useState(false);

  // Toàn bộ dữ liệu (không lọc): dùng cho đời và quan hệ trong ngăn chi tiết
  const fullIndex = useMemo(() => buildIndex(people, links, partners), [people, links, partners]);
  const gens = useMemo(() => computeGenerations(fullIndex), [fullIndex]);
  // Cây lớn mà thu vừa khung thì chữ quá nhỏ: bắt đầu ở người được chọn / hồ sơ của tôi, hoặc tổ tiên cao nhất (không chọn)
  const [focus, setFocus] = useState<{ id: string; nonce: number; select?: boolean } | null>(() => {
    if (initialFocusId) return { id: initialFocusId, nonce: 0 };
    if (people.length > 40) {
      const root = buildOutline(fullIndex)[0]?.id;
      if (root) return { id: root, nonce: 0, select: false };
    }
    return null;
  });
  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  // Lọc theo nhánh (gồm nhánh con)
  const view = useMemo(() => {
    if (!branch) return { people, links, partners, core: null as Set<string> | null };
    return filterByBranch(people, links, partners, branch === "none" ? "none" : branchWithDescendants(branches, branch));
  }, [branch, people, links, partners, branches]);
  const index = useMemo(() => buildIndex(view.people, view.links, view.partners), [view]);
  const elements = useMemo(() => buildElements(index), [index]);
  const divorced = useMemo(() => new Set(elements.unions.filter((u) => u.partnership && u.partnership.status !== "married" && u.partnership.status !== "partner").map((u) => u.id)), [elements]);
  // Chỉ dàn bố cục khi đang xem sơ đồ (tính phía client, ghi nhớ theo dữ liệu + hướng)
  const placed = useMemo(() => (mode === "diagram" ? layoutGraph(elements.nodes, elements.edges, direction) : null), [mode, elements, direction]);

  const results = useMemo(() => searchPeople(view.people, query, 8), [view.people, query]);

  const focusPerson = useCallback((id: string) => {
    setMode("diagram");
    // Người đang bị lọc ẩn: bỏ lọc để có thể chạy tới
    if (branch && !index.people.has(id)) setBranch("");
    setSelectedId(id);
    setPanelOpen(true);
    setFocus({ id, nonce: Date.now() });
  }, [branch, index]);

  const onSelect = useCallback((id: string | null) => { setSelectedId(id); if (id) setPanelOpen(true); }, []);
  const pick = (id: string) => { setQuery(""); focusPerson(id); };
  const selectedPerson = selectedId ? fullIndex.people.get(selectedId) : null;
  const legendBranches = useMemo(() => branches.filter((b) => people.some((p) => p.branchId === b.id)), [branches, people]);
  const flowKey = `${direction}|${branch}`;

  if (people.length === 0) {
    return (
      <div className="rounded-2xl border border-champagne/60 bg-ivory p-6 text-base">
        Chưa có thành viên nào.{canEdit && <> <Link href="/thanh-vien/moi" className="font-semibold text-wine underline">Thêm thành viên đầu tiên</Link>.</>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Kiểu hiển thị" className="flex">
          <button type="button" className={seg(mode === "diagram")} aria-pressed={mode === "diagram"} onClick={() => setMode("diagram")}>Sơ đồ</button>
          <button type="button" className={seg(mode === "list")} aria-pressed={mode === "list"} onClick={() => setMode("list")}>Danh sách theo đời</button>
        </div>
        <button type="button" aria-expanded={showOpts} onClick={() => setShowOpts((v) => !v)}
          className="min-h-12 rounded-xl border border-wine px-4 text-base font-semibold text-wine hover:bg-champagne-soft sm:hidden">
          {showOpts ? "Ẩn tùy chọn" : "Lọc nhánh, hướng…"}
        </button>
        {selfId && fullIndex.people.has(selfId) && (
          <button type="button" onClick={() => focusPerson(selfId)}
            className="min-h-12 rounded-xl border border-wine px-4 text-base font-semibold text-wine hover:bg-champagne-soft">Tới hồ sơ của tôi</button>
        )}

        <div className="relative w-full min-w-56 flex-1 sm:w-auto">
          <label className="block text-sm font-semibold">Tìm người
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" role="combobox"
              aria-expanded={mode === "diagram" && results.length > 0} aria-controls="tree-search-results"
              onKeyDown={(e) => { if (e.key === "Enter" && mode === "diagram" && results[0]) { e.preventDefault(); pick(results[0].id); } }}
              placeholder="Gõ tên, không cần dấu"
              className="mt-1 block min-h-12 w-full rounded-xl border border-ink-soft/40 bg-white px-4 py-2 text-base font-normal text-ink" />
          </label>
          {mode === "diagram" && query.trim() !== "" && (
            <ul id="tree-search-results" role="listbox" aria-label="Kết quả tìm kiếm"
              className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-champagne bg-ivory shadow-lg">
              {results.length === 0 ? <li className="px-4 py-3 text-base text-ink-soft">Không tìm thấy ai.</li> : results.map((r) => (
                <li key={r.id} role="option" aria-selected={false}>
                  <button type="button" onClick={() => pick(r.id)} className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-base hover:bg-champagne-soft">
                    <Avatar name={r.name} src={r.avatar} gender={r.gender} size={32} />
                    <span>{r.name}<span className="text-sm text-ink-soft"> {lifeSpan(r.by, r.dy, r.dead)}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${showOpts ? "grid" : "hidden"} w-full grid-cols-2 gap-3 sm:contents`}>
          <label className="block text-sm font-semibold">Nhánh
            <select value={branch} onChange={(e) => setBranch(e.target.value)}
              className="mt-1 block min-h-12 w-full rounded-xl border border-ink-soft/40 bg-white px-3 text-base font-normal text-ink">
              <option value="">Tất cả các nhánh</option>
              <option value="none">Chưa xếp nhánh</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          {mode === "diagram" && (
            <label className="block text-sm font-semibold">Hướng
              <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}
                className="mt-1 block min-h-12 w-full rounded-xl border border-ink-soft/40 bg-white px-3 text-base font-normal text-ink">
                <option value="TB">Từ trên xuống</option>
                <option value="LR">Từ trái sang phải</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {branch && view.core && (
        <p className="rounded-xl bg-champagne-soft px-4 py-3 text-base">
          Đang lọc theo nhánh: hiện {view.core.size} thành viên của nhánh cùng vợ/chồng và cha mẹ của họ (phần mờ là người thuộc nhánh khác, giữ lại để nối quan hệ).
        </p>
      )}

      {mode === "diagram" ? (
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative h-[68dvh] min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-champagne/60 bg-white">
            {elements.nodes.length === 0 ? (
              <p className="p-6 text-base text-ink-soft">Không có ai thuộc nhánh này.</p>
            ) : placed && (
              <FamilyFlow key={flowKey} nodes={elements.nodes} edges={elements.edges} placed={placed} index={index} gens={gens}
                divorcedUnions={divorced} direction={direction} core={view.core} focus={focus} initialSelectedId={selectedId}
                onSelect={onSelect} />
            )}
          </div>
          {selectedPerson && selectedId && (
            <TreePersonPanel id={selectedId} index={fullIndex} gens={gens}
              branchName={selectedPerson.branchId ? (branchName.get(selectedPerson.branchId) ?? null) : null}
              canEdit={canEdit} open={panelOpen} onToggle={() => setPanelOpen((v) => !v)} onClose={() => setSelectedId(null)} onFocus={focusPerson} />
          )}
        </div>
      ) : (
        <FamilyOutline index={index} gens={gens} query={query} highlightId={selectedId} onShowInDiagram={focusPerson} />
      )}

      <details className="rounded-xl border border-champagne/60 bg-ivory px-4">
        <summary className="min-h-12 cursor-pointer py-3 text-base font-semibold text-wine">Chú giải</summary>
        <ul className="space-y-2 pb-4 text-base">
          <li><span className="mr-2 inline-block h-4 w-8 rounded border-2 border-[#6f8fb0] bg-[#f3f7fb] align-middle" />Viền xanh: nam · <span className="mr-2 ml-2 inline-block h-4 w-8 rounded border-2 border-[#c9798a] bg-[#fdf3f5] align-middle" />viền hồng: nữ · <span className="mr-2 ml-2 inline-block h-4 w-8 rounded border-2 border-champagne bg-ivory align-middle" />khác/chưa rõ</li>
          <li>Chấm tròn vàng giữa hai người: <strong>cặp vợ chồng / gia đình</strong> (chấm trắng: đã ly hôn hoặc góa); các con nối xuống từ chấm đó.</li>
          <li>Nét liền: con ruột. Nét đứt: con nuôi hoặc con kế. Dấu † và chữ “đã mất”: người đã mất.</li>
          <li>Dải màu bên trái mỗi ô là màu của nhánh họ:
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {legendBranches.map((b) => (
                <li key={b.id}><span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: branchColor(b.id) }} />{b.name}</li>
              ))}
              <li><span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: branchColor(null) }} />Chưa xếp nhánh</li>
            </ul>
          </li>
          <li>Mẹo: bấm vào một người để xem chi tiết; trên điện thoại dùng hai ngón để phóng to, thu nhỏ. Cần đọc bằng bàn phím hoặc trình đọc màn hình: chọn “Danh sách theo đời”.</li>
        </ul>
      </details>
    </div>
  );
}
