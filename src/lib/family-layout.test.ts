import { describe, expect, it } from "vitest";
import { buildElements, buildIndex } from "./family-graph";
import { layoutGraph, PERSON_H, PERSON_W } from "./family-layout";
import type { TreeLink, TreePartner, TreePerson } from "./members-types";

const P = (id: string, by = 1900): TreePerson => ({ id, name: id, nick: null, gender: null, branchId: null, by, dy: null, dead: false, avatar: null, gen: null });

/** Cây giả lập: mỗi cặp có 1-4 con, qua nhiều đời, tới ~n người. */
function synthetic(n: number) {
  const people: TreePerson[] = [P("r0"), P("r0s")];
  const links: TreeLink[] = [];
  const partners: TreePartner[] = [{ id: "pr0", a: "r0", b: "r0s", status: "married", start: null, end: null }];
  let queue = [["r0", "r0s"]];
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let i = 0;
  while (people.length < n && queue.length) {
    const next: string[][] = [];
    for (const [a, b] of queue) {
      const kids = 1 + Math.floor(rnd() * 4);
      for (let k = 0; k < kids && people.length < n; k++) {
        const c = `c${i++}`;
        const s = `s${i}`;
        people.push(P(c), P(s));
        links.push({ id: `${c}>${a}`, child: c, parent: a, kind: "biological" }, { id: `${c}>${b}`, child: c, parent: b, kind: "biological" });
        partners.push({ id: `p${c}`, a: c, b: s, status: "married", start: null, end: null });
        next.push([c, s]);
      }
    }
    queue = next;
  }
  return { people, links, partners };
}

describe("layoutGraph", () => {
  const { people, links, partners } = synthetic(60);
  const el = buildElements(buildIndex(people, links, partners));

  it("mỗi nút đều có vị trí hữu hạn", () => {
    const pos = layoutGraph(el.nodes, el.edges, "TB");
    expect(pos.size).toBe(el.nodes.length);
    for (const p of pos.values()) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });
  it("dọc: cha mẹ nằm trên nút gia đình, nút gia đình nằm trên con", () => {
    const pos = layoutGraph(el.nodes, el.edges, "TB");
    for (const e of el.edges) expect(pos.get(e.source)!.y).toBeLessThan(pos.get(e.target)!.y);
  });
  it("ngang: cha mẹ nằm bên trái con", () => {
    const pos = layoutGraph(el.nodes, el.edges, "LR");
    for (const e of el.edges) expect(pos.get(e.source)!.x).toBeLessThan(pos.get(e.target)!.x);
  });
  it("kiểu phả đồ BT: cha mẹ nằm DƯỚI con (tổ ở gốc cây phía dưới)", () => {
    const pos = layoutGraph(el.nodes, el.edges, "BT");
    for (const e of el.edges) expect(pos.get(e.source)!.y).toBeGreaterThan(pos.get(e.target)!.y);
  });
  it("các nút người không chồng lên nhau", () => {
    for (const dir of ["TB", "BT", "LR"] as const) {
      const pos = layoutGraph(el.nodes, el.edges, dir);
      const boxes = el.nodes.filter((n) => n.type === "person").map((n) => pos.get(n.id)!);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const overlap = a.x < b.x + PERSON_W && b.x < a.x + PERSON_W && a.y < b.y + PERSON_H && b.y < a.y + PERSON_H;
        expect(overlap).toBe(false);
      }
    }
  });
  it("người kết hôn vào được xếp cùng hàng với vợ/chồng (không bị đẩy lên đời đầu)", () => {
    const pos = layoutGraph(el.nodes, el.edges, "TB");
    const c = pos.get("c5")!, s = pos.get("s6") ?? pos.get(people.find((p) => p.id.startsWith("s") && partners.some((q) => q.a === "c5" && q.b === p.id))!.id)!;
    expect(Math.abs(c.y - s.y)).toBeLessThan(PERSON_H);
  });
  it("hiệu năng: ~1000 thành viên dàn trong thời gian chấp nhận được", () => {
    const big = synthetic(1000);
    const bel = buildElements(buildIndex(big.people, big.links, big.partners));
    const t0 = performance.now();
    const pos = layoutGraph(bel.nodes, bel.edges, "TB");
    const ms = performance.now() - t0;
    expect(pos.size).toBe(bel.nodes.length);
    expect(big.people.length).toBeGreaterThanOrEqual(1000);
    console.log(`[perf] ${big.people.length} người, ${bel.nodes.length} nút, ${bel.edges.length} cạnh: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(8000);
  }, 20000);
});
