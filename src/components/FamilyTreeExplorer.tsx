"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { FamilyOutline } from "@/components/FamilyOutline";
import { TreePersonPanel } from "@/components/TreePersonPanel";
import {
  branchWithDescendants, buildElements, buildIndex, buildOutline, computeGenerations, descendantsOf, filterByBranch, parentIdsOf, searchPeople,
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
  `min-h-9 shrink-0 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold border shadow ${active ? "border-[#c9932f] bg-gradient-to-b from-[#ffe9a8] to-[#e9bc57] text-[#5d3a17]" : "border-white/70 bg-white/90 text-[#33506e] hover:bg-white"}`;
const pillBtn =
  "min-h-9 shrink-0 whitespace-nowrap rounded-full border border-white/70 bg-white/90 px-3 text-[13px] font-semibold text-[#33506e] shadow hover:bg-white";

export function FamilyTreeExplorer({ familyName, people, links, partners, branches, initialFocusId, selfId, canEdit, canArrange = false }: {
  familyName: string;
  people: TreePerson[]; links: TreeLink[]; partners: TreePartner[]; branches: BranchRow[];
  initialFocusId: string | null; selfId: string | null; canEdit: boolean; canArrange?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("diagram");
  // Huong cay CO DINH tu tren xuong nhu mau thiet ke (nguoi dung chot 31/10/2026: khong dung kieu to o goc nua)
  const direction: Direction = "TB";
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
  // Thu gọn nhánh: ẩn toàn bộ con cháu của những người đang gập (dữ liệu gốc không đổi,
  // chỉ ẩn khi hiển thị; tìm kiếm/ngăn chi tiết vẫn dùng dữ liệu đầy đủ).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const hiddenIds = useMemo(() => {
    const out = new Set<string>();
    for (const id of collapsed) for (const d of descendantsOf(fullIndex, id)) out.add(d);
    return out;
  }, [collapsed, fullIndex]);
  const hiddenCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of collapsed) m.set(id, descendantsOf(fullIndex, id).size);
    return m;
  }, [collapsed, fullIndex]);
  const onToggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);
  const vis = useMemo(() => {
    if (hiddenIds.size === 0) return view;
    const people = view.people.filter((p) => !hiddenIds.has(p.id));
    const ids = new Set(people.map((p) => p.id));
    return {
      people,
      links: view.links.filter((l) => ids.has(l.child) && ids.has(l.parent)),
      partners: view.partners.filter((pt) => ids.has(pt.a) && ids.has(pt.b)),
      core: view.core,
    };
  }, [view, hiddenIds]);
  const index = useMemo(() => buildIndex(vis.people, vis.links, vis.partners), [vis]);
  const elements = useMemo(() => buildElements(index), [index]);
  const divorced = useMemo(() => new Set(elements.unions.filter((u) => u.partnership && u.partnership.status !== "married" && u.partnership.status !== "partner").map((u) => u.id)), [elements]);
  // Chỉ dàn bố cục khi đang xem sơ đồ (tính phía client, ghi nhớ theo dữ liệu + hướng)
  const placed = useMemo(() => (mode === "diagram" ? layoutGraph(elements.nodes, elements.edges, direction) : null), [mode, elements, direction]);

  const results = useMemo(() => searchPeople(view.people, query, 8), [view.people, query]);

  const focusPerson = useCallback((id: string) => {
    setMode("diagram");
    // Người đang bị lọc ẩn: bỏ lọc để có thể chạy tới
    if (branch && !index.people.has(id)) setBranch("");
    // Người đang bị thu gọn ẩn: mở lại mọi nhánh tổ tiên đang gập chứa họ
    setCollapsed((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      for (const cid of prev) if (descendantsOf(fullIndex, cid).has(id)) next.delete(cid);
      return next.size === prev.size ? prev : next;
    });
    setSelectedId(id);
    setPanelOpen(true);
    setFocus({ id, nonce: Date.now() });
  }, [branch, index, fullIndex]);

  const onSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    // Vua an giu de them nguoi thi khong mo ngan chi tiet (menu them dang hien)
    if (id && Date.now() - quickAddAt.current > 800) setPanelOpen(true);
  }, []);
  // An giu vao huy hieu mot nguoi (hoac chuot phai): mo menu them nhanh con / cha me / vo chong
  const [quickAddId, setQuickAddId] = useState<string | null>(null);
  const quickAddAt = useRef(0);
  const onQuickAdd = useCallback((id: string) => {
    quickAddAt.current = Date.now();
    if (canEdit) setQuickAddId(id);
    else { setSelectedId(id); setPanelOpen(true); }
  }, [canEdit]);
  const quickAddPerson = quickAddId ? fullIndex.people.get(quickAddId) ?? null : null;
  const qaItem = "flex min-h-11 w-full items-center justify-center rounded-full border border-[#d9b878] bg-white px-3 text-[15px] font-semibold text-[#7c4a12] shadow-sm hover:bg-[#fdf2df]";
  const pick = (id: string) => { setQuery(""); focusPerson(id); };
  const selectedPerson = selectedId ? fullIndex.people.get(selectedId) : null;
  const legendBranches = useMemo(() => branches.filter((b) => people.some((p) => p.branchId === b.id)), [branches, people]);
  const flowKey = `${direction}|${branch}|${[...collapsed].sort().join(",")}`;

  if (people.length === 0) {
    return (
      <div className="rounded-2xl border border-[#ffd97a]/30 bg-[#2e1c0c]/90 p-6 text-base text-[#f8e9c4]">
        Chưa có thành viên nào.{canEdit && <> <Link href="/thanh-vien/moi" className="font-semibold text-[#ffd97a] underline">Thêm thành viên đầu tiên</Link>.</>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mot khoi canh lien nhu anh mau: nen nha tho ho phu sang nhe lam nen chung,
          cong cu noi tren canh, bien go ten dong ho, cay o duoi — mot giao dien thong nhat. */}
      <div className="relative overflow-hidden rounded-[1.75rem] bg-[#f7ead2] shadow-2xl ring-1 ring-[#3f270f]/40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/temple-bg.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[#fff8ea]/35" />
      <div className="relative z-10 flex flex-wrap items-end gap-1.5 px-2 pt-2 text-[#3f270f] sm:px-3 sm:pt-3">
        <div role="group" aria-label="Kiểu hiển thị" className="flex shrink-0 gap-1.5">
          <button type="button" className={seg(mode === "diagram")} aria-pressed={mode === "diagram"} onClick={() => setMode("diagram")}>🌳 Sơ đồ</button>
          <button type="button" className={seg(mode === "list")} aria-pressed={mode === "list"} onClick={() => setMode("list")}>📋 Danh sách theo đời</button>
        </div>
        <button type="button" aria-expanded={showOpts} onClick={() => setShowOpts((v) => !v)}
          className={`${pillBtn} sm:hidden`}>
          {showOpts ? "Ẩn tùy chọn" : "Lọc nhánh…"}
        </button>
        {selfId && fullIndex.people.has(selfId) && (
          <button type="button" onClick={() => focusPerson(selfId)}
            className={pillBtn}>Tới hồ sơ của tôi</button>
        )}

        <div className="relative w-full min-w-56 flex-1 sm:w-auto">
          <label className="block text-sm font-semibold">Tìm người
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" role="combobox"
              aria-expanded={mode === "diagram" && results.length > 0} aria-controls="tree-search-results"
              onKeyDown={(e) => { if (e.key === "Enter" && mode === "diagram" && results[0]) { e.preventDefault(); pick(results[0].id); } }}
              placeholder="Gõ tên, không cần dấu"
              className="mt-1 block min-h-10 w-full rounded-full border border-[#c9932f]/60 bg-white/95 px-4 py-1.5 text-sm font-normal text-ink" />
          </label>
          {mode === "diagram" && query.trim() !== "" && (
            <ul id="tree-search-results" role="listbox" aria-label="Kết quả tìm kiếm"
              className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-sky-200 bg-white shadow-lg">
              {results.length === 0 ? <li className="px-4 py-3 text-base text-ink-soft">Không tìm thấy ai.</li> : results.map((r) => (
                <li key={r.id} role="option" aria-selected={false}>
                  <button type="button" onClick={() => pick(r.id)} className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-base hover:bg-sky-50">
                    <Avatar name={r.name} src={r.avatar} gender={r.gender} size={32} />
                    <span>{r.name}<span className="text-sm text-ink-soft"> {lifeSpan(r.by, r.dy, r.dead)}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${showOpts ? "grid" : "hidden"} w-full grid-cols-1 gap-3 sm:contents`}>
          <label className="block text-sm font-semibold">Nhánh
            <select value={branch} onChange={(e) => setBranch(e.target.value)}
              className="mt-1 block min-h-10 w-full rounded-xl border border-[#c9932f]/60 bg-white/95 px-3 text-sm font-normal text-ink">
              <option value="">Tất cả các nhánh</option>
              <option value="none">Chưa xếp nhánh</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Bien go cham khac ten dong ho nhu anh mau */}
      <div className="pointer-events-none relative z-10 flex justify-center px-3 pt-1.5">
        <div className="max-w-[86%] rounded-xl border-2 border-[#3f270f] bg-gradient-to-b from-[#5d3d1e] to-[#3a2410] px-4 py-1 text-center shadow-[inset_0_0_0_2px_rgba(255,217,122,0.35),0_10px_15px_-3px_rgba(0,0,0,0.4)] sm:px-6 sm:py-1.5">
          <p className="truncate text-base font-bold tracking-wide text-[#ffd97a] drop-shadow sm:text-lg">{familyName}</p>
          <p className="truncate text-[10px] font-medium text-[#ffca7a] sm:text-[11px]">Gìn giữ cội nguồn · Kết nối yêu thương</p>
        </div>
      </div>

      {branch && view.core && (
        <p className="relative z-10 mx-3 mt-2 rounded-xl bg-[#fff7dd]/95 px-4 py-2.5 text-sm text-[#5d3a17] shadow">
          Đang lọc theo nhánh: hiện {view.core.size} thành viên của nhánh cùng vợ/chồng và cha mẹ của họ (phần mờ là người thuộc nhánh khác, giữ lại để nối quan hệ).
        </p>
      )}

      {mode === "diagram" ? (
        <div className="relative z-10 flex flex-col gap-3 p-2 pt-1.5 sm:p-3 sm:pt-2 md:flex-row">
          <div className="relative h-[54dvh] min-h-[380px] flex-1 overflow-hidden rounded-2xl sm:h-[68dvh]">
            {/* Bien go nho goc duoi trai nhu mau: loi nhan cua dong ho */}
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden -rotate-3 sm:block">
              <div className="rounded-lg border-2 border-[#6f4423] bg-gradient-to-b from-[#c89b62] to-[#a9743f] px-3 py-2 shadow-lg">
                <p className="text-sm font-bold italic leading-snug text-[#4a2c14]">Gia đình là điểm tựa<br />của hạnh phúc ❤</p>
              </div>
            </div>
            {/* Nhac xoay ngang tren dien thoai doc: cay ngang rong, xem doc khong du thi xoay may */}
            <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-bold text-[#ffeec2] portrait:flex md:portrait:hidden">
              <span aria-hidden="true">↻</span> Xoay ngang điện thoại để xem cây đầy đủ
            </div>
            {elements.nodes.length === 0 ? (
              <p className="relative p-6 text-base text-ink-soft">Không có ai thuộc nhánh này.</p>
            ) : placed && (
              <FamilyFlow key={flowKey} nodes={elements.nodes} edges={elements.edges} placed={placed} index={index} gens={gens}
                divorcedUnions={divorced} direction={direction} core={view.core} focus={focus} initialSelectedId={selectedId}
                onSelect={onSelect} onQuickAdd={onQuickAdd}
                collapsedIds={collapsed} hiddenCounts={hiddenCounts} onToggleCollapse={onToggleCollapse} />
            )}
          </div>
          {selectedPerson && selectedId && (
            <TreePersonPanel id={selectedId} index={fullIndex} gens={gens}
              branchName={selectedPerson.branchId ? (branchName.get(selectedPerson.branchId) ?? null) : null}
              canEdit={canEdit} canArrange={canArrange} open={panelOpen} onToggle={() => setPanelOpen((v) => !v)} onClose={() => setSelectedId(null)} onFocus={focusPerson} />
          )}
        </div>
      ) : (
        <div className="relative z-10 m-3 rounded-2xl bg-[#fffaf1]/95 px-3 py-3">
          <FamilyOutline index={index} gens={gens} query={query} highlightId={selectedId} onShowInDiagram={focusPerson} />
        </div>
      )}
      </div>

      {quickAddPerson && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center" role="dialog" aria-modal="true"
          aria-label={`Thêm người thân của ${quickAddPerson.name}`} onClick={() => setQuickAddId(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <Avatar name={quickAddPerson.name} src={quickAddPerson.avatar} gender={quickAddPerson.gender} size={52} />
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-[#4a2c14]">{quickAddPerson.name}</p>
                <p className="text-sm text-ink-soft">Thêm người thân vào nhánh này</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href={`/thanh-vien/moi?rel=parent&g=male&to=${quickAddPerson.id}`} className={qaItem}>＋ Thêm cha</Link>
              <Link href={`/thanh-vien/moi?rel=parent&g=female&to=${quickAddPerson.id}`} className={qaItem}>＋ Thêm mẹ</Link>
              <Link href={`/thanh-vien/moi?rel=partner&g=female&to=${quickAddPerson.id}`} className={qaItem}>＋ Thêm vợ</Link>
              <Link href={`/thanh-vien/moi?rel=partner&g=male&to=${quickAddPerson.id}`} className={qaItem}>＋ Thêm chồng</Link>
              <Link href={`/thanh-vien/moi?rel=child&g=male&to=${quickAddPerson.id}`} className={qaItem}>＋ Thêm con trai</Link>
              <Link href={`/thanh-vien/moi?rel=child&g=female&to=${quickAddPerson.id}`} className={qaItem}>＋ Thêm con gái</Link>
              {parentIdsOf(fullIndex, quickAddPerson.id).length > 0 ? (
                <Link href={`/thanh-vien/moi?rel=sibling&to=${quickAddPerson.id}`} className={`${qaItem} col-span-2`}>＋ Thêm anh / chị / em</Link>
              ) : (
                <p className="col-span-2 rounded-xl bg-[#fdf2df] px-3 py-2 text-center text-[13px] leading-snug text-ink-soft">
                  Muốn thêm anh/chị/em cho {quickAddPerson.name} thì cần có cha hoặc mẹ của họ trên cây trước.
                </p>
              )}
              <button type="button" className="col-span-2 flex min-h-12 w-full items-center justify-center rounded-full bg-gradient-to-b from-[#ffe9a8] to-[#e9bc57] px-4 text-base font-bold text-[#5d3a17] shadow-sm hover:brightness-105"
                onClick={() => { setQuickAddId(null); setSelectedId(quickAddPerson.id); setPanelOpen(true); }}>Xem chi tiết</button>
              <button type="button" className="col-span-2 flex min-h-12 w-full items-center justify-center rounded-full px-4 text-base font-semibold text-ink-soft hover:bg-[#fdf2df]"
                onClick={() => setQuickAddId(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      <details className="rounded-xl border border-[#ffd97a]/25 bg-[#2e1c0c]/90 px-4 text-[#f8e9c4]">
        <summary className="min-h-12 cursor-pointer py-3 text-base font-semibold text-[#ffd97a]">Chú giải</summary>
        <ul className="space-y-2 pb-4 text-base">
          <li>Mỗi người là một <strong>huy hiệu ảnh tròn</strong> với <strong>bảng tên vàng</strong> bên dưới, treo trên cành cây như phả đồ truyền thống. Vòng quanh ảnh: <span className="font-semibold text-[#6f8fb0]">xanh dương: nam</span> · <span className="font-semibold text-[#c9798a]">hồng: nữ</span> · vàng champagne: khác/chưa rõ.</li>
          <li>Cây vẽ <strong>từ trên xuống</strong>: tổ tiên ở trên cùng, con cháu tỏa dần xuống dưới; trong mỗi gia đình, anh chị em xếp từ lớn đến nhỏ (admin là người sắp xếp thứ tự này).</li>
          <li>Bấm <strong>nút +</strong> trên huy hiệu một người (hoặc ấn giữ / chuột phải) để mở menu thêm cha, mẹ, vợ, chồng, con trai, con gái, anh/chị/em — lưu xong người mới hiện ngay trên cây với đường nối đúng quan hệ.</li>
          <li>Nút <strong>− / +N</strong> dưới huy hiệu: thu gọn hoặc mở lại nhánh con cháu của người đó (N là số người đang ẩn).</li>
          <li>Trái tim vàng giữa hai người: <strong>cặp vợ chồng / gia đình</strong> (trái tim xám: đã ly hôn hoặc góa); các con nối từ trái tim đó bằng cành cây màu vàng.</li>
          <li>Cành liền: con ruột. Cành đứt nét: con nuôi hoặc con kế. Dấu † và ảnh xám: người đã mất.</li>
          <li>Chấm màu nhỏ cạnh năm sinh là màu của nhánh họ:
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {legendBranches.map((b) => (
                <li key={b.id}><span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: branchColor(b.id) }} />{b.name}</li>
              ))}
              <li><span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: branchColor(null) }} />Chưa xếp nhánh</li>
            </ul>
          </li>
          <li>Mẹo: bấm vào ảnh một người để xem đầy đủ thông tin; trên điện thoại dùng hai ngón để phóng to, thu nhỏ. Cần đọc bằng bàn phím hoặc trình đọc màn hình: chọn “Danh sách theo đời”.</li>
        </ul>
      </details>
    </div>
  );
}
