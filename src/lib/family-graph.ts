// Thuật toán thuần dựng đồ thị gia phả: chỉ mục quan hệ, nút "gia đình" (union), đời, anh chị em, dàn ý thụt lề, lọc theo nhánh.
// Không phụ thuộc React/Next để kiểm thử được bằng vitest.
import { foldVietnamese } from "./members-text";
import type { ParentKind, TreeLink, TreePartner, TreePerson } from "./members-types";

export type FamilyIndex = {
  people: Map<string, TreePerson>;
  parentsOf: Map<string, TreeLink[]>;
  childrenOf: Map<string, TreeLink[]>;
  partnersOf: Map<string, TreePartner[]>;
};

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const a = m.get(k);
  if (a) a.push(v); else m.set(k, [v]);
}

/** Bỏ qua quan hệ trỏ tới người không có trong danh sách (đã bị xóa hoặc bị lọc) và quan hệ trùng. */
export function buildIndex(people: TreePerson[], links: TreeLink[], partners: TreePartner[]): FamilyIndex {
  const pm = new Map(people.map((p) => [p.id, p]));
  const parentsOf = new Map<string, TreeLink[]>();
  const childrenOf = new Map<string, TreeLink[]>();
  const partnersOf = new Map<string, TreePartner[]>();
  const seenLink = new Set<string>();
  for (const l of links) {
    if (!pm.has(l.child) || !pm.has(l.parent) || l.child === l.parent) continue;
    const key = `${l.child}>${l.parent}`;
    if (seenLink.has(key)) continue;
    seenLink.add(key);
    push(parentsOf, l.child, l);
    push(childrenOf, l.parent, l);
  }
  const seenPair = new Set<string>();
  for (const p of partners) {
    if (!pm.has(p.a) || !pm.has(p.b) || p.a === p.b) continue;
    const key = p.a < p.b ? `${p.a}|${p.b}` : `${p.b}|${p.a}`;
    if (seenPair.has(key)) continue;
    seenPair.add(key);
    push(partnersOf, p.a, p);
    push(partnersOf, p.b, p);
  }
  return { people: pm, parentsOf, childrenOf, partnersOf };
}

const other = (p: TreePartner, id: string) => (p.a === id ? p.b : p.a);
export function partnerIds(ix: FamilyIndex, id: string): string[] {
  return (ix.partnersOf.get(id) ?? []).map((p) => other(p, id));
}

// ---------- Union (nút gia đình) ----------
export type Union = {
  id: string;
  parents: string[];
  children: string[];
  /** loại quan hệ cha mẹ-con nổi bật của từng con (ruột / nuôi / kế) */
  childKind: Record<string, ParentKind>;
  partnership: TreePartner | null;
};

const unionId = (parents: string[]) => `u|${parents.join("|")}`;
export const isUnionId = (id: string) => id.startsWith("u|");

function dominantKind(kinds: ParentKind[]): ParentKind {
  if (kinds.every((k) => k === "biological")) return "biological";
  return kinds.includes("adoptive") ? "adoptive" : "step";
}

/**
 * Một union cho mỗi bộ cha mẹ (từ 2 người) có con và cho mỗi cặp vợ chồng (kể cả chưa có con).
 * Con chỉ có MỘT cha/mẹ được nối thẳng từ người đó (không tạo union).
 */
export function buildUnions(ix: FamilyIndex): Union[] {
  const map = new Map<string, Union>();
  const ensure = (parents: string[]) => {
    const sorted = [...parents].sort();
    const id = unionId(sorted);
    let u = map.get(id);
    if (!u) { u = { id, parents: sorted, children: [], childKind: {}, partnership: null }; map.set(id, u); }
    return u;
  };
  for (const [child, ls] of ix.parentsOf) {
    if (ls.length < 2) continue;
    const u = ensure(ls.map((l) => l.parent));
    u.children.push(child);
    u.childKind[child] = dominantKind(ls.map((l) => l.kind));
  }
  const seen = new Set<string>();
  for (const list of ix.partnersOf.values()) {
    for (const p of list) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      ensure([p.a, p.b]).partnership = p;
    }
  }
  const unions = [...map.values()];
  // Con trong mỗi gia đình xếp lớn -> nhỏ (ưu tiên thứ tự admin xếp tay, rồi năm sinh, rồi tên)
  const order = byBirth(ix);
  for (const u of unions) u.children.sort((x, y) => order({ id: x }, { id: y }));
  return unions;
}

// ---------- Phần tử đồ thị ----------
export type GraphNode = { id: string; type: "person" | "union" };
export type GraphEdge = { id: string; source: string; target: string; role: "spouse" | "child"; kind: ParentKind };

export function buildElements(ix: FamilyIndex): { nodes: GraphNode[]; edges: GraphEdge[]; unions: Union[] } {
  const unions = buildUnions(ix);
  const nodes: GraphNode[] = [];
  // Đưa nút người vào theo đúng thứ tự duyệt cây (lớn -> nhỏ) để dagre khởi đầu
  // đã gần với thứ tự mong muốn, hạn chế việc nó tự đảo anh chị em.
  const seen = new Set<string>();
  for (const item of buildOutline(ix)) {
    if (ix.people.has(item.id) && !seen.has(item.id)) { seen.add(item.id); nodes.push({ id: item.id, type: "person" }); }
    for (const s of item.spouses) if (ix.people.has(s.id) && !seen.has(s.id)) { seen.add(s.id); nodes.push({ id: s.id, type: "person" }); }
  }
  for (const id of ix.people.keys()) if (!seen.has(id)) nodes.push({ id, type: "person" });
  const edges: GraphEdge[] = [];
  for (const u of unions) {
    nodes.push({ id: u.id, type: "union" });
    for (const p of u.parents) edges.push({ id: `${p}>${u.id}`, source: p, target: u.id, role: "spouse", kind: "biological" });
    for (const c of u.children) edges.push({ id: `${u.id}>${c}`, source: u.id, target: c, role: "child", kind: u.childKind[c] ?? "biological" });
  }
  for (const [child, ls] of ix.parentsOf) {
    if (ls.length !== 1) continue;
    edges.push({ id: `${ls[0].parent}>${child}`, source: ls[0].parent, target: child, role: "child", kind: ls[0].kind });
  }
  return { nodes, edges, unions };
}

// ---------- Đời ----------
/** Đời tính từ gốc (1 = tổ tiên cao nhất); người kết hôn vào (không có cha mẹ) lấy đời của vợ/chồng. */
export function computeGenerations(ix: FamilyIndex): Map<string, number> {
  const gen = new Map<string, number>();
  const indeg = new Map<string, number>();
  const queue: string[] = [];
  for (const id of ix.people.keys()) {
    const n = ix.parentsOf.get(id)?.length ?? 0;
    indeg.set(id, n);
    if (n === 0) { gen.set(id, 1); queue.push(id); }
  }
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const l of ix.childrenOf.get(id) ?? []) {
      gen.set(l.child, Math.max(gen.get(l.child) ?? 1, (gen.get(id) ?? 1) + 1));
      const left = (indeg.get(l.child) ?? 1) - 1;
      indeg.set(l.child, left);
      if (left === 0) queue.push(l.child);
    }
  }
  for (const id of ix.people.keys()) if (!gen.has(id)) gen.set(id, 1); // phòng dữ liệu có vòng lặp
  // Căn đời cho người không có cha mẹ theo vợ/chồng, rồi đẩy xuống con cháu (lặp tới khi ổn định)
  for (let iter = 0; iter < 60; iter++) {
    let changed = false;
    for (const id of ix.people.keys()) {
      if ((ix.parentsOf.get(id)?.length ?? 0) === 0) {
        let g = gen.get(id) ?? 1;
        for (const pid of partnerIds(ix, id)) g = Math.max(g, gen.get(pid) ?? 1);
        if (g !== gen.get(id)) { gen.set(id, g); changed = true; }
      }
      for (const l of ix.childrenOf.get(id) ?? []) {
        const want = (gen.get(id) ?? 1) + 1;
        if ((gen.get(l.child) ?? 1) < want) { gen.set(l.child, want); changed = true; }
      }
    }
    if (!changed) break;
  }
  return gen;
}

// ---------- Anh chị em ----------
export function siblingsOf(ix: FamilyIndex, id: string): { id: string; full: boolean }[] {
  const mine = new Set((ix.parentsOf.get(id) ?? []).map((l) => l.parent));
  const found = new Map<string, Set<string>>();
  for (const p of mine) {
    for (const l of ix.childrenOf.get(p) ?? []) {
      if (l.child === id) continue;
      const s = found.get(l.child) ?? new Set<string>();
      s.add(p);
      found.set(l.child, s);
    }
  }
  const out: { id: string; full: boolean }[] = [];
  for (const [sid, shared] of found) {
    const theirs = new Set((ix.parentsOf.get(sid) ?? []).map((l) => l.parent));
    const full = shared.size === mine.size && shared.size === theirs.size;
    out.push({ id: sid, full });
  }
  return out.sort(byBirth(ix));
}

// ---------- Sắp xếp ----------
const collator = new Intl.Collator("vi");
function cmp(a: TreePerson, b: TreePerson): number {
  // Thứ tự admin xếp tay (display_order) là cao nhất: ai đã được xếp thì theo số đó,
  // người chưa xếp (mới thêm) đứng sau; chưa ai xếp thì theo năm sinh rồi tên như trước.
  const ao = a.ord ?? null, bo = b.ord ?? null;
  if (ao != null && bo != null && ao !== bo) return ao - bo;
  if (ao != null && bo == null) return -1;
  if (ao == null && bo != null) return 1;
  if (a.by != null && b.by != null && a.by !== b.by) return a.by - b.by;
  if (a.by != null && b.by == null) return -1;
  if (a.by == null && b.by != null) return 1;
  return collator.compare(a.name, b.name) || (a.id < b.id ? -1 : 1);
}
function byBirth(ix: FamilyIndex) {
  return (x: { id: string }, y: { id: string }) => cmp(ix.people.get(x.id)!, ix.people.get(y.id)!);
}

// ---------- Dàn ý thụt lề (chế độ danh sách) ----------
export type OutlineSpouse = { id: string; status: TreePartner["status"]; shownHere: boolean };
export type OutlineItem = { id: string; depth: number; spouses: OutlineSpouse[]; kind: ParentKind | null };

/**
 * Cây thụt lề theo đời: mỗi người xuất hiện đúng một lần (dưới cha/mẹ gặp trước); vợ/chồng ghi cạnh.
 * Vợ/chồng không có cha mẹ được gộp vào dòng của người kia (kèm con riêng của họ).
 */
export function buildOutline(ix: FamilyIndex): OutlineItem[] {
  const visited = new Set<string>();
  const out: OutlineItem[] = [];
  const order = byBirth(ix);

  const visit = (id: string, depth: number, kind: ParentKind | null) => {
    if (visited.has(id)) return;
    visited.add(id);
    const spouses: OutlineSpouse[] = [];
    const absorbed: string[] = [];
    for (const p of [...(ix.partnersOf.get(id) ?? [])].sort((x, y) => order({ id: other(x, id) }, { id: other(y, id) }))) {
      const sid = other(p, id);
      const rootless = (ix.parentsOf.get(sid)?.length ?? 0) === 0;
      if (rootless && !visited.has(sid)) {
        visited.add(sid);
        absorbed.push(sid);
        spouses.push({ id: sid, status: p.status, shownHere: true });
      } else {
        spouses.push({ id: sid, status: p.status, shownHere: false });
      }
    }
    out.push({ id, depth, spouses, kind });
    const kids = new Map<string, ParentKind>();
    for (const holder of [id, ...absorbed]) {
      for (const l of ix.childrenOf.get(holder) ?? []) if (!kids.has(l.child)) kids.set(l.child, l.kind);
    }
    for (const cid of [...kids.keys()].sort((x, y) => order({ id: x }, { id: y }))) visit(cid, depth + 1, kids.get(cid)!);
  };

  const ids = [...ix.people.keys()];
  const noParents = ids.filter((id) => (ix.parentsOf.get(id)?.length ?? 0) === 0);
  const trueRoots = noParents.filter((id) => partnerIds(ix, id).every((p) => (ix.parentsOf.get(p)?.length ?? 0) === 0));
  for (const id of trueRoots.sort((x, y) => order({ id: x }, { id: y }))) visit(id, 0, null);
  for (const id of noParents.sort((x, y) => order({ id: x }, { id: y }))) visit(id, 0, null);
  for (const id of ids.sort((x, y) => order({ id: x }, { id: y }))) visit(id, 0, null); // phòng còn sót
  return out;
}

// ---------- Lọc theo nhánh ----------
/** Tập mã nhánh gồm chính nó và mọi nhánh con. */
export function branchWithDescendants(branches: { id: string; parent_branch_id: string | null }[], rootId: string): Set<string> {
  const kids = new Map<string, string[]>();
  for (const b of branches) if (b.parent_branch_id) push(kids, b.parent_branch_id, b.id);
  const out = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const k of kids.get(cur) ?? []) if (!out.has(k)) { out.add(k); stack.push(k); }
  }
  return out;
}

/**
 * Giữ các thành viên thuộc nhánh + vợ/chồng + cha mẹ trực tiếp của họ (để các nút "gia đình" vẫn nối được).
 * `core` là phần thuộc nhánh thật sự; phần còn lại nên được làm mờ.
 */
export function filterByBranch(
  people: TreePerson[], links: TreeLink[], partners: TreePartner[], branchIds: Set<string> | "none",
): { people: TreePerson[]; links: TreeLink[]; partners: TreePartner[]; core: Set<string> } {
  const core = new Set<string>();
  for (const p of people) {
    if (branchIds === "none" ? p.branchId == null : p.branchId != null && branchIds.has(p.branchId)) core.add(p.id);
  }
  const keep = new Set(core);
  for (const pt of partners) {
    if (core.has(pt.a)) keep.add(pt.b);
    if (core.has(pt.b)) keep.add(pt.a);
  }
  for (const l of links) if (core.has(l.child)) keep.add(l.parent);
  return {
    people: people.filter((p) => keep.has(p.id)),
    links: links.filter((l) => keep.has(l.child) && keep.has(l.parent)),
    partners: partners.filter((p) => keep.has(p.a) && keep.has(p.b)),
    core,
  };
}

// ---------- Tìm kiếm ----------
export function searchPeople(people: TreePerson[], query: string, limit = 8): TreePerson[] {
  const q = foldVietnamese(query);
  if (!q) return [];
  const scored: { p: TreePerson; s: number }[] = [];
  for (const p of people) {
    const n = foldVietnamese(p.name);
    const k = p.nick ? foldVietnamese(p.nick) : "";
    let s = -1;
    if (n === q || k === q) s = 0;
    else if (n.startsWith(q) || k.startsWith(q)) s = 1;
    else if (n.split(" ").some((w) => w.startsWith(q))) s = 2;
    else if (n.includes(q) || k.includes(q)) s = 3;
    if (s >= 0) scored.push({ p, s });
  }
  scored.sort((a, b) => a.s - b.s || cmp(a.p, b.p));
  return scored.slice(0, limit).map((x) => x.p);
}
