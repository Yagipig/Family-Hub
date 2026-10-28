// Dàn vị trí cây gia phả bằng dagre (tính phía client, có thể chạy trong test).
import dagre from "@dagrejs/dagre";
import type { GraphEdge, GraphNode } from "./family-graph";

export type Direction = "TB" | "LR";
export const PERSON_W = 210;
export const PERSON_H = 76;
export const UNION_SIZE = 18;

export type Placed = { x: number; y: number; w: number; h: number };

/** Trả về toạ độ GÓC TRÊN-TRÁI của từng nút (React Flow dùng góc trên-trái). */
export function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], direction: Direction): Map<string, Placed> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: direction === "TB" ? 36 : 22,
    ranksep: direction === "TB" ? 70 : 110,
    marginx: 20,
    marginy: 20,
    ranker: "network-simplex",
  });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) {
    g.setNode(n.id, n.type === "union" ? { width: UNION_SIZE, height: UNION_SIZE } : { width: PERSON_W, height: PERSON_H });
  }
  for (const e of edges) g.setEdge(e.source, e.target, { weight: e.role === "spouse" ? 2 : 1 });
  dagre.layout(g);
  const out = new Map<string, Placed>();
  for (const n of nodes) {
    const d = g.node(n.id);
    out.set(n.id, { x: d.x - d.width / 2, y: d.y - d.height / 2, w: d.width, h: d.height });
  }
  return out;
}
