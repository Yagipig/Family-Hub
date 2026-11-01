"use client";
import { toPng } from "html-to-image";
import "@xyflow/react/dist/style.css";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Handle, MiniMap, Panel, Position, ReactFlow, ReactFlowProvider, useNodesState, useReactFlow,
  type Edge, type Node, type NodeProps, type NodeTypes, type OnSelectionChangeParams,
} from "@xyflow/react";
import { Avatar } from "@/components/Avatar";
import type { FamilyIndex, GraphEdge, GraphNode } from "@/lib/family-graph";
import { PERSON_H, PERSON_W, UNION_SIZE, type Direction, type Placed } from "@/lib/family-layout";
import { branchColor, lifeSpan } from "@/lib/members-text";
import type { TreePerson } from "@/lib/members-types";

type GhostData = { label: string; href: string; dim: boolean };
type GhostNodeT = Node<GhostData, "ghost">;

type PersonData = {
  person: TreePerson; gen: number | null; dim: boolean; color: string;
  onQuickAdd: () => void;
  /** Thu gọn nhánh: người này có con cháu, đang thu gọn hay không, và số người đang ẩn */
  hasChildren: boolean; collapsed: boolean; hiddenCount: number; onToggleCollapse: () => void;
};
type UnionData = { divorced: boolean };
type PersonNodeT = Node<PersonData, "person">;
type UnionNodeT = Node<UnionData, "union">;

const hiddenHandle = { opacity: 0, pointerEvents: "none", width: 1, height: 1, minWidth: 1, minHeight: 1 } as const;

/** Màu vòng quanh ảnh: xanh = nam, hồng = nữ, vàng champagne = khác/chưa rõ. */
const RING: Record<string, string> = {
  male: "border-[#6f8fb0]",
  female: "border-[#c9798a]",
  other: "border-champagne",
};

/** Ô người kiểu phả đồ truyền thống: huy hiệu ảnh tròn ở trên, bảng tên vàng ở dưới. */
const PersonCard = memo(function PersonCard({ data, selected, sourcePosition, targetPosition }: NodeProps<PersonNodeT>) {
  const { person: p, gen, dim, color } = data;
  const span = lifeSpan(p.by, p.dy, p.dead);
  // An giu (550ms, khong di chuyen) de mo menu them nhanh; chuot phai cung vay. Keo/di chuyen thi huy.
  const pressTimer = useRef<number | null>(null);
  const cancelPress = () => {
    if (pressTimer.current != null) { window.clearTimeout(pressTimer.current); pressTimer.current = null; }
  };
  const startPress = () => {
    cancelPress();
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      try { navigator.vibrate?.(30); } catch { /* may khong ho tro rung */ }
      data.onQuickAdd();
    }, 550);
  };
  return (
    <div
      style={{ width: PERSON_W, height: PERSON_H }}
      onPointerDown={startPress} onPointerUp={cancelPress} onPointerLeave={cancelPress} onPointerMove={cancelPress}
      onContextMenu={(e) => { e.preventDefault(); data.onQuickAdd(); }}
      className={`relative flex flex-col items-center px-2 pt-1.5 ${dim ? "opacity-40" : ""}`}>
      <div className={`relative rounded-full bg-gradient-to-b from-[#ffe9a8] via-[#e9bc57] to-[#cf9c33] p-[3px] shadow-lg ${selected ? "shadow-[0_0_0_4px_rgba(245,197,66,0.95),0_0_30px_rgba(245,158,11,0.9)]" : ""}`}>
        <div className={`rounded-full border-2 bg-white ${RING[p.gender ?? "other"]} ${p.dead ? "grayscale" : ""}`}>
          <Avatar name={p.name} src={p.avatar} gender={p.gender} size={58} />
        </div>
        {p.dead
          ? <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 rounded-full bg-ivory px-1 text-sm leading-tight text-ink-soft shadow">†</span>
          : <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-green-500 shadow" />}
        {/* Ký hiệu giới tính ở góc trái huy hiệu */}
        {(p.gender === "male" || p.gender === "female") && (
          <span aria-hidden="true" className={`absolute -bottom-0.5 -left-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[11px] font-black shadow ${p.gender === "male" ? "bg-[#dbeafe] text-[#1d4ed8]" : "bg-[#fce7f3] text-[#be185d]"}`}>
            {p.gender === "male" ? "♂" : "♀"}
          </span>
        )}
        {/* Nút + luôn hiện ở góc huy hiệu: bấm là mở menu thêm người thân (không cần ấn giữ nữa) */}
        <button
          type="button"
          aria-label={`Thêm người thân của ${p.name}`}
          title="Thêm người thân"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); data.onQuickAdd(); }}
          className="absolute -left-1.5 -top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[#b8912f] bg-gradient-to-b from-[#ffe9a8] to-[#e9bc57] text-base font-black leading-none text-[#7c2d12] shadow-md hover:brightness-105"
        >
          +
        </button>
      </div>
      <div className="mt-1.5 w-full rounded-lg border border-[#b8912f] bg-gradient-to-b from-[#f9e28d] to-[#efc95e] px-2 py-1 shadow-sm">
        <p className="line-clamp-2 text-center text-[14px] font-bold leading-tight text-[#571c10]">{p.name}</p>
      </div>
      <p className="mt-1 flex max-w-full items-center gap-1.5 rounded-full bg-white/80 px-2 py-0.5 text-[12px] leading-tight text-ink-soft shadow-sm">
        <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/10" style={{ background: color }} />
        <span className="truncate">{[p.nick ? `“${p.nick}”` : null, span, gen ? `Đời ${gen}` : null].filter(Boolean).join(" · ")}</span>
      </p>
      {/* Nút thu gọn / mở nhánh con cháu của người này */}
      {data.hasChildren && (
        <button
          type="button"
          aria-label={data.collapsed ? `Mở nhánh con cháu của ${p.name} (${data.hiddenCount} người đang ẩn)` : `Thu gọn nhánh con cháu của ${p.name}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); data.onToggleCollapse(); }}
          className="absolute -bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[#3f270f] bg-[#5d3d1e] px-2.5 py-0.5 text-[11px] font-bold leading-tight text-[#ffd97a] shadow-md hover:bg-[#6d4a26]"
        >
          {data.collapsed ? `+ ${data.hiddenCount}` : "−"}
        </button>
      )}
      <Handle type="target" position={targetPosition ?? Position.Top} isConnectable={false} style={hiddenHandle} />
      <Handle type="source" position={sourcePosition ?? Position.Bottom} isConnectable={false} style={hiddenHandle} />
    </div>
  );
});

/** Cặp vợ chồng: trái tim vàng phát sáng như mẫu thiết kế (trái tim xám khi đã ly hôn/góa). */
const UnionDot = memo(function UnionDot({ data, sourcePosition, targetPosition }: NodeProps<UnionNodeT>) {
  return (
    <div title="Gia đình (cặp vợ chồng)" style={{ width: UNION_SIZE, height: UNION_SIZE }} className="relative">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_6px_rgba(245,158,11,0.9)]">
        <defs>
          <linearGradient id="unionHeartGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd97a" />
            <stop offset="100%" stopColor="#e8a013" />
          </linearGradient>
        </defs>
        <path
          d="M12 20.5S3.5 15.1 3.5 9.7A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.5 2.9c0 5.4-8.5 10.8-8.5 10.8Z"
          fill={data.divorced ? "#d6d3d1" : "url(#unionHeartGold)"}
          stroke={data.divorced ? "#a8a29e" : "#b8860b"}
          strokeWidth="1.4"
        />
      </svg>
      <Handle type="target" position={targetPosition ?? Position.Top} isConnectable={false} style={hiddenHandle} />
      <Handle type="source" position={sourcePosition ?? Position.Bottom} isConnectable={false} style={hiddenHandle} />
    </div>
  );
});

/** Thẻ trống theo khuôn mẫu: viền đứt nét, bấm vào là thêm người vào đúng vị trí đó. */
const GhostCard = memo(function GhostCard({ data, sourcePosition, targetPosition }: NodeProps<GhostNodeT>) {
  return (
    <a
      href={data.href}
      aria-label={`Ô trống ${data.label} — bấm để thêm người`}
      style={{ width: PERSON_W, height: PERSON_H }}
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#b8912f]/80 bg-white/55 px-2 text-center shadow-sm transition hover:bg-white/90 ${data.dim ? "opacity-40" : ""}`}
    >
      <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-[#b8912f] text-2xl font-black leading-none text-[#b8912f]">+</span>
      <span className="text-base font-bold leading-tight text-[#7c4a12]">{data.label}</span>
      <span className="text-[11px] font-medium leading-tight text-ink-soft">Ô trống — bấm để thêm</span>
      <Handle type="target" position={targetPosition ?? Position.Top} isConnectable={false} style={hiddenHandle} />
      <Handle type="source" position={sourcePosition ?? Position.Bottom} isConnectable={false} style={hiddenHandle} />
    </a>
  );
});

const nodeTypes: NodeTypes = { person: PersonCard, union: UnionDot, ghost: GhostCard };

const EDGE_STYLE = {
  spouse: { stroke: "#f0c75e", strokeWidth: 2.5, filter: "drop-shadow(0 0 3px rgba(240,199,94,0.9))" },
  child: { stroke: "#d9a441", strokeWidth: 3, filter: "drop-shadow(0 0 3px rgba(217,164,65,0.75))" },
  childDashed: { stroke: "#d9a441", strokeWidth: 3, strokeDasharray: "7 5", filter: "drop-shadow(0 0 3px rgba(217,164,65,0.75))" },
} as const;

export type FlowProps = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  placed: Map<string, Placed>;
  index: FamilyIndex;
  gens: Map<string, number>;
  divorcedUnions: Set<string>;
  direction: Direction;
  /** Người thuộc nhánh đang lọc (phần còn lại làm mờ); null = không lọc */
  core: Set<string> | null;
  focus: { id: string; nonce: number; select?: boolean } | null;
  initialSelectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Ấn giữ / chuột phải / nút + trên huy hiệu: mở menu thêm người thân */
  onQuickAdd: (id: string) => void;
  /** Thu gọn nhánh: tập người đang thu gọn + số con cháu đang ẩn của từng người */
  collapsedIds: Set<string>;
  hiddenCounts: Map<string, number>;
  onToggleCollapse: (id: string) => void;
  /** Thẻ trống khuôn mẫu theo ID nút: nhãn vị trí + đường dẫn thêm người + làm mờ khi lọc nhánh */
  ghosts: Map<string, GhostData>;
};

function Inner(p: FlowProps) {
  const rf = useReactFlow();
  const initialSel = useRef(p.initialSelectedId);
  // TB: tổ ở trên, con cháu xuống dưới. BT (kiểu phả đồ): tổ ở gốc dưới, con cháu lên trên. LR: trái -> phải.
  const handlePos = p.direction === "LR"
    ? { source: Position.Right, target: Position.Left }
    : p.direction === "BT"
      ? { source: Position.Top, target: Position.Bottom }
      : { source: Position.Bottom, target: Position.Top };
  const [ready, setReady] = useState(false);

  const initialNodes = useMemo<Node[]>(() => p.nodes.map((n) => {
    const pos = p.placed.get(n.id)!;
    const base = {
      id: n.id, position: { x: pos.x, y: pos.y }, draggable: false, connectable: false,
      sourcePosition: handlePos.source, targetPosition: handlePos.target,
      initialWidth: pos.w, initialHeight: pos.h,
    };
    if (n.type === "union") return { ...base, type: "union", selectable: false, focusable: false, data: { divorced: p.divorcedUnions.has(n.id) } } as UnionNodeT;
    if (n.type === "ghost") {
      const g = p.ghosts.get(n.id);
      return { ...base, type: "ghost", selectable: false, focusable: false, data: { label: g?.label ?? "Ô trống", href: g?.href ?? "#", dim: g?.dim ?? false } } as GhostNodeT;
    }
    const person = p.index.people.get(n.id)!;
    return {
      ...base, type: "person", selected: n.id === initialSel.current,
      ariaLabel: `${person.name}${person.dead ? ", đã mất" : ""}${person.by ? `, sinh năm ${person.by}` : ""}. Nhấn Enter để xem chi tiết.`,
      data: {
        person, gen: person.gen ?? p.gens.get(n.id) ?? null, dim: p.core != null && !p.core.has(n.id), color: branchColor(person.branchId),
        onQuickAdd: () => p.onQuickAdd(n.id),
        hasChildren: (p.index.childrenOf.get(n.id)?.length ?? 0) > 0,
        collapsed: p.collapsedIds.has(n.id),
        hiddenCount: p.hiddenCounts.get(n.id) ?? 0,
        onToggleCollapse: () => p.onToggleCollapse(n.id),
      },
    } as PersonNodeT;
  // Bố cục chỉ đổi khi component được gắn lại (key đổi) nên bỏ qua phụ thuộc còn lại
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);

  const edges = useMemo<Edge[]>(() => p.edges.map((e) => ({
    id: e.id, source: e.source, target: e.target, selectable: false, focusable: false,
    // Đường con dùng smoothstep (gấp khúc vuông): từ trái tim đi xuống rồi rẽ ngang vào từng con
    // như sơ đồ gia phả cổ điển; đường vợ chồng giữ cong mềm ngang qua trái tim.
    type: e.role === "spouse" ? "default" : "smoothstep",
    pathOptions: e.role === "spouse" ? undefined : { borderRadius: 14 },
    style: e.role === "spouse" ? EDGE_STYLE.spouse : e.kind === "biological" ? EDGE_STYLE.child : EDGE_STYLE.childDashed,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), []);

  // Chạy tới một nút: căn giữa + chọn
  useEffect(() => {
    const f = p.focus;
    // Chờ khung nhìn khởi tạo xong (onInit) rồi mới căn giữa, nếu không setCenter bị bỏ qua
    if (!f || !ready) return;
    const pl = p.placed.get(f.id);
    if (!pl) return;
    const t = window.setTimeout(() => {
      void rf.setCenter(pl.x + pl.w / 2, pl.y + pl.h / 2, { zoom: Math.max(rf.getZoom(), 0.9), duration: 600 });
      if (f.select !== false) setNodes((ns) => ns.map((n) => (n.type !== "person" || n.selected === (n.id === f.id) ? n : { ...n, selected: n.id === f.id })));
    }, 60);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.focus, ready]);

  const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    p.onSelect(sel.find((n) => n.type === "person")?.id ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.onSelect]);

  // Xuất ảnh: đưa toàn bộ cây vào khung nhìn rồi chụp khung hiện tại (cây rất lớn sẽ nhỏ chữ; dùng "In / PDF" hoặc phóng to từng nhánh).
  const [exporting, setExporting] = useState(false);
  const exportPng = useCallback(async () => {
    const el = document.querySelector<HTMLElement>(".react-flow");
    if (!el) return;
    setExporting(true);
    try {
      await rf.fitView({ duration: 0, padding: 0.1 });
      await new Promise((r) => window.setTimeout(r, 400));
      const url = await toPng(el, {
        pixelRatio: 2, backgroundColor: "#fbf6ec", cacheBust: true,
        filter: (n) => !(n instanceof HTMLElement && (n.classList.contains("react-flow__minimap") || n.classList.contains("react-flow__panel"))),
      });
      const a = document.createElement("a");
      a.href = url; a.download = "gia-pha.png"; a.click();
    } catch {
      window.alert("Không xuất được ảnh. Hãy thử bấm \"In / lưu PDF\" hoặc thu nhỏ cây rồi chụp màn hình.");
    } finally {
      setExporting(false);
    }
  }, [rf]);

  const miniColor = useCallback((n: Node) => (n.type === "union" ? "#c9a96b" : n.type === "ghost" ? "#d8cfc0" : ((n.data as PersonData).color)), []);
  const btn = "min-h-12 min-w-12 rounded-xl border border-sky-200 bg-white/95 px-3 text-base font-bold text-sky-900 shadow-md hover:bg-sky-50";

  return (
    <ReactFlow
      nodes={nodes} edges={edges} onNodesChange={onNodesChange} nodeTypes={nodeTypes}
      onSelectionChange={onSelectionChange} onInit={() => setReady(true)}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable nodesFocusable edgesFocusable={false}
      minZoom={0.04} maxZoom={2} fitView={!p.focus} fitViewOptions={{ padding: 0.15 }}
      onlyRenderVisibleElements zoomOnDoubleClick={false} panOnScroll={false}
      aria-label="Sơ đồ cây gia phả. Kéo để di chuyển, hai ngón tay hoặc nút phóng to, thu nhỏ để đổi kích cỡ."
    >
      <MiniMap pannable zoomable nodeColor={miniColor} nodeStrokeWidth={2} maskColor="rgba(123,30,43,0.12)"
        className="!hidden sm:!block" ariaLabel="Bản đồ thu nhỏ của cây gia phả" />
      <Panel position="top-right" className="flex flex-col gap-2">
        <button type="button" className={btn} aria-label="Phóng to" onClick={() => void rf.zoomIn({ duration: 200 })}>＋</button>
        <button type="button" className={btn} aria-label="Thu nhỏ" onClick={() => void rf.zoomOut({ duration: 200 })}>－</button>
        <button type="button" className={btn} aria-label="Xem toàn bộ cây" onClick={() => void rf.fitView({ duration: 400, padding: 0.15 })}>▢</button>
        <button type="button" className={`${btn} text-sm`} disabled={exporting} onClick={() => void exportPng()}>{exporting ? "Đang xuất…" : "Tải ảnh"}</button>
        <button type="button" className={`${btn} text-sm`} onClick={() => window.print()}>In / PDF</button>
      </Panel>
    </ReactFlow>
  );
}

/** memo: gõ vào ô tìm kiếm ở thanh công cụ không làm sơ đồ dựng lại. */
export const FamilyFlow = memo(function FamilyFlow(props: FlowProps) {
  return <ReactFlowProvider><Inner {...props} /></ReactFlowProvider>;
});
