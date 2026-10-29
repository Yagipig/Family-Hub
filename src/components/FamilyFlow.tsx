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

type PersonData = { person: TreePerson; gen: number | null; dim: boolean; color: string };
type UnionData = { divorced: boolean };
type PersonNodeT = Node<PersonData, "person">;
type UnionNodeT = Node<UnionData, "union">;

const hiddenHandle = { opacity: 0, pointerEvents: "none", width: 1, height: 1, minWidth: 1, minHeight: 1 } as const;

const TONE: Record<string, string> = {
  male: "border-[#6f8fb0] bg-[#f3f7fb]",
  female: "border-[#c9798a] bg-[#fdf3f5]",
  other: "border-champagne bg-ivory",
};

const PersonCard = memo(function PersonCard({ data, selected, sourcePosition, targetPosition }: NodeProps<PersonNodeT>) {
  const { person: p, gen, dim, color } = data;
  const span = lifeSpan(p.by, p.dy, p.dead);
  return (
    <div
      style={{ width: PERSON_W, height: PERSON_H }}
      className={`relative flex items-center gap-2 overflow-hidden rounded-xl border-2 pl-3.5 pr-2 shadow-sm ${TONE[p.gender ?? "other"]} ${selected ? "ring-4 ring-champagne" : ""} ${dim ? "opacity-40" : ""}`}>
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-2" style={{ background: color }} />
      <Avatar name={p.name} src={p.avatar} gender={p.gender} size={40} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-bold leading-tight text-ink">{p.name}</p>
        <p className="truncate text-[13px] text-ink-soft">{[p.nick ? `“${p.nick}”` : null, span, gen ? `Đời ${gen}` : null].filter(Boolean).join(" · ")}</p>
      </div>
      {p.dead && <span aria-hidden="true" className="absolute right-1.5 top-0.5 text-sm text-ink-soft">†</span>}
      <Handle type="target" position={targetPosition ?? Position.Top} isConnectable={false} style={hiddenHandle} />
      <Handle type="source" position={sourcePosition ?? Position.Bottom} isConnectable={false} style={hiddenHandle} />
    </div>
  );
});

const UnionDot = memo(function UnionDot({ data, sourcePosition, targetPosition }: NodeProps<UnionNodeT>) {
  return (
    <div title="Gia đình (cặp vợ chồng)" style={{ width: UNION_SIZE, height: UNION_SIZE }}
      className={`rounded-full border-2 border-wine ${data.divorced ? "bg-white" : "bg-champagne"}`}>
      <Handle type="target" position={targetPosition ?? Position.Top} isConnectable={false} style={hiddenHandle} />
      <Handle type="source" position={sourcePosition ?? Position.Bottom} isConnectable={false} style={hiddenHandle} />
    </div>
  );
});

const nodeTypes: NodeTypes = { person: PersonCard, union: UnionDot };

const EDGE_STYLE = {
  spouse: { stroke: "#c9a96b", strokeWidth: 2 },
  child: { stroke: "#7b1e2b", strokeWidth: 1.6 },
  childDashed: { stroke: "#7b1e2b", strokeWidth: 1.6, strokeDasharray: "7 5" },
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
};

function Inner(p: FlowProps) {
  const rf = useReactFlow();
  const initialSel = useRef(p.initialSelectedId);
  const vertical = p.direction === "TB";
  const [ready, setReady] = useState(false);

  const initialNodes = useMemo<Node[]>(() => p.nodes.map((n) => {
    const pos = p.placed.get(n.id)!;
    const base = {
      id: n.id, position: { x: pos.x, y: pos.y }, draggable: false, connectable: false,
      sourcePosition: vertical ? Position.Bottom : Position.Right, targetPosition: vertical ? Position.Top : Position.Left,
      initialWidth: pos.w, initialHeight: pos.h,
    };
    if (n.type === "union") return { ...base, type: "union", selectable: false, focusable: false, data: { divorced: p.divorcedUnions.has(n.id) } } as UnionNodeT;
    const person = p.index.people.get(n.id)!;
    return {
      ...base, type: "person", selected: n.id === initialSel.current,
      ariaLabel: `${person.name}${person.dead ? ", đã mất" : ""}${person.by ? `, sinh năm ${person.by}` : ""}. Nhấn Enter để xem chi tiết.`,
      data: { person, gen: person.gen ?? p.gens.get(n.id) ?? null, dim: p.core != null && !p.core.has(n.id), color: branchColor(person.branchId) },
    } as PersonNodeT;
  // Bố cục chỉ đổi khi component được gắn lại (key đổi) nên bỏ qua phụ thuộc còn lại
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);

  const edges = useMemo<Edge[]>(() => p.edges.map((e) => ({
    id: e.id, source: e.source, target: e.target, type: "smoothstep", selectable: false, focusable: false,
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

  const miniColor = useCallback((n: Node) => (n.type === "union" ? "#c9a96b" : ((n.data as PersonData).color)), []);
  const btn = "min-h-12 min-w-12 rounded-xl border border-wine bg-ivory px-3 text-base font-bold text-wine shadow-sm hover:bg-champagne-soft";

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
