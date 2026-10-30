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
  `min-h-11 px-4 text-sm md:text-base md:min-h-12 md:px-5 font-semibold first:rounded-l-xl last:rounded-r-xl border border-wine ${active ? "bg-wine text-white" : "bg-ivory text-wine hover:bg-champagne-soft"}`;

export function FamilyTreeExplorer({ people, links, partners, branches, initialFocusId, selfId, canEdit, canArrange = false }: {
  people: TreePerson[]; links: TreeLink[]; partners: TreePartner[]; branches: BranchRow[];
  initialFocusId: string | null; selfId: string | null; canEdit: boolean; canArrange?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("diagram");
  const [direction, setDirection] = useState<Direction>("BT");
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
	          className="min-h-10 rounded-xl border border-wine px-3 text-sm font-semibold text-wine hover:bg-champagne-soft sm:hidden md:min-h-12 md:px-4 md:text-base">
	          {showOpts ? "Ẩn lọc" : "Lọc nhánh…"}
	        </button>
	        {selfId && fullIndex.people.has(selfId) && (
	          <button type="button" onClick={() => focusPerson(selfId)}
	            className="min-h-10 rounded-xl border border-wine px-3 text-sm font-semibold text-wine hover:bg-champagne-soft md:min-h-12 md:px-4 md:text-base">Tới tôi</button>
	        )}

	        <div className="relative w-full min-w-48 flex-1 sm:w-auto">
	          <label className="block text-xs font-semibold md:text-sm">Tìm người
	            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" role="combobox"
	              aria-expanded={mode === "diagram" && results.length > 0} aria-controls="tree-search-results"
	              onKeyDown={(e) => { if (e.key === "Enter" && mode === "diagram" && results[0]) { e.preventDefault(); pick(results[0].id); } }}
	              placeholder="Gõ tên (không dấu)"
	              className="mt-1 block min-h-10 w-full rounded-xl border border-ink-soft/40 bg-white px-3 py-1.5 text-sm font-normal text-ink md:min-h-12 md:px-4 md:py-2 md:text-base" />
	          </label>
	          {mode === "diagram" && query.trim() !== "" && (
	            <ul id="tree-search-results" role="listbox" aria-label="Kết quả tìm kiếm"
	              className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-xl border border-champagne bg-ivory shadow-lg">
	              {results.length === 0 ? <li className="px-3 py-2 text-sm text-ink-soft md:px-4 md:py-3 md:text-base">Không tìm thấy.</li> : results.map((r) => (
	                <li key={r.id} role="option" aria-selected={false}>
	                  <button type="button" onClick={() => pick(r.id)} className="flex min-h-10 w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-champagne-soft md:min-h-12 md:gap-3 md:px-4 md:py-2 md:text-base">
	                    <Avatar name={r.name} src={r.avatar} gender={r.gender} size={28} />
	                    <span>{r.name}<span className="text-xs text-ink-soft md:text-sm"> {lifeSpan(r.by, r.dy, r.dead)}</span></span>
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
                <option value="BT">Kiểu cây phả đồ (tổ ở gốc, con cháu lên trên)</option>
                <option value="TB">Từ trên xuống (tổ ở trên)</option>
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
	        <div className="flex flex-col gap-3 md:flex-row md:gap-4">
	          <div className="relative h-[58dvh] min-h-[340px] flex-1 overflow-hidden rounded-2xl border-4 border-double border-[#c9a96b] shadow-inner md:h-[68dvh] md:min-h-[420px]"
	            style={{ background: "linear-gradient(180deg, #fdf8ec 0%, #f9efdb 55%, #f3e5c6 100%)" }}>
	            {elements.nodes.length === 0 ? (
	              <p className="p-4 text-sm text-ink-soft md:p-6 md:text-base">Không có ai thuộc nhánh này.</p>
	            ) : placed && (
	              <FamilyFlow key={flowKey} nodes={elements.nodes} edges={elements.edges} placed={placed} index={index} gens={gens}
	                divorcedUnions={divorced} direction={direction} core={view.core} focus={focus} initialSelectedId={selectedId}
	                onSelect={onSelect} />
	            )}
	          </div>
	          {selectedPerson && selectedId && (
	            <TreePersonPanel id={selectedId} index={fullIndex} gens={gens}
	              branchName={selectedPerson.branchId ? (branchName.get(selectedPerson.branchId) ?? null) : null}
	              canEdit={canEdit} canArrange={canArrange} open={panelOpen} onToggle={() => setPanelOpen((v) => !v)} onClose={() => setSelectedId(null)} onFocus={focusPerson} />
	          )}
	        </div>
	      ) : (
        <FamilyOutline index={index} gens={gens} query={query} highlightId={selectedId} onShowInDiagram={focusPerson} />
      )}

	      <details className="rounded-xl border border-champagne/60 bg-ivory px-3 md:px-4">
	        <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-wine md:min-h-12 md:py-3 md:text-base">Chú giải</summary>
	        <ul className="space-y-1.5 pb-3 text-sm md:space-y-2 md:pb-4 md:text-base">
	          <li>Mỗi người là <strong>huy hiệu ảnh tròn</strong> + <strong>bảng tên vàng</strong>. Vòng quanh: <span className="font-semibold text-[#6f8fb0]">xanh: nam</span> · <span className="font-semibold text-[#c9798a]">hồng: nữ</span>.</li>
	          <li>Tổ tiên ở dưới, con cháu lên trên. Chấm vàng giữa hai người = cặp vợ/chồng. Cành liền = con ruột.</li>
	          <li>Chấm màu nhỏ = nhánh họ. Dấu † = đã mất.</li>
	          <li>Mẹo: chạm 2 ngón để zoom trên điện thoại. Hoặc chọn “Danh sách theo đời”.</li>
	        </ul>
	      </details>
    </div>
  );
}
