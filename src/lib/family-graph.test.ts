import { describe, expect, it } from "vitest";
import {
  branchWithDescendants, buildElements, buildIndex, buildOutline, buildUnions, computeGenerations, filterByBranch,
  isUnionId, searchPeople, siblingsOf,
} from "./family-graph";
import type { TreeLink, TreePartner, TreePerson } from "./members-types";

const P = (id: string, name: string, by: number | null = null, branchId: string | null = null): TreePerson => ({
  id, name, nick: null, gender: null, branchId, by, dy: null, dead: false, avatar: null, gen: null,
});
const L = (child: string, parent: string, kind: TreeLink["kind"] = "biological"): TreeLink => ({ id: `${child}>${parent}`, child, parent, kind });
const M = (a: string, b: string, status: TreePartner["status"] = "married"): TreePartner => ({ id: `${a}+${b}`, a, b, status, start: null, end: null });

// Ông Nội + Bà Nội -> Bố, Chú ; Bố + Mẹ -> Bé A, Bé B ; Mẹ là người kết hôn vào ; Chú không vợ con
const people = [
  P("gp", "Ông Nội", 1950), P("gm", "Bà Nội", 1953), P("dad", "Bố", 1975, "A"), P("uncle", "Chú", 1980, "A"),
  P("mom", "Mẹ", 1978), P("a", "Bé A", 2010, "A"), P("b", "Bé B", 2012, "B"),
];
const links = [L("dad", "gp"), L("dad", "gm"), L("uncle", "gp"), L("uncle", "gm"), L("a", "dad"), L("a", "mom"), L("b", "dad"), L("b", "mom")];
const partners = [M("gp", "gm"), M("dad", "mom")];

describe("buildIndex", () => {
  it("bỏ quan hệ trỏ tới người không tồn tại, quan hệ trùng và tự trỏ", () => {
    const ix = buildIndex(people, [...links, L("x", "dad"), L("dad", "dad"), L("a", "dad")], [...partners, M("gp", "zzz"), M("gm", "gp")]);
    expect(ix.parentsOf.get("a")).toHaveLength(2);
    expect(ix.parentsOf.has("x")).toBe(false);
    expect(ix.parentsOf.get("dad")).toHaveLength(2);
    expect(ix.partnersOf.get("gp")).toHaveLength(1);
  });
});

describe("buildUnions / buildElements", () => {
  const ix = buildIndex(people, links, partners);
  it("mỗi bộ cha mẹ có con và mỗi cặp vợ chồng có một union", () => {
    const u = buildUnions(ix);
    expect(u).toHaveLength(2);
    const gpU = u.find((x) => x.parents.join() === ["gm", "gp"].sort().join())!;
    expect(gpU.children.sort()).toEqual(["dad", "uncle"]);
    expect(gpU.partnership?.status).toBe("married");
    const dadU = u.find((x) => x.parents.includes("mom"))!;
    expect(dadU.children.sort()).toEqual(["a", "b"]);
  });
  it("cặp vợ chồng chưa có con vẫn có union", () => {
    const u = buildUnions(buildIndex([P("x", "X"), P("y", "Y")], [], [M("x", "y")]));
    expect(u).toHaveLength(1);
    expect(u[0].children).toEqual([]);
  });
  it("con chỉ có một cha/mẹ nối thẳng, không tạo union", () => {
    const el = buildElements(buildIndex([P("p", "P"), P("c", "C")], [L("c", "p")], []));
    expect(el.unions).toHaveLength(0);
    expect(el.edges).toEqual([{ id: "p>c", source: "p", target: "c", role: "child", kind: "biological" }]);
  });
  it("nút union có mã nhận biết được và cạnh nối đủ cha mẹ -> union -> con", () => {
    const el = buildElements(ix);
    const unions = el.nodes.filter((n) => n.type === "union");
    expect(unions.every((n) => isUnionId(n.id))).toBe(true);
    expect(el.nodes.filter((n) => n.type === "person")).toHaveLength(people.length);
    const dadU = el.unions.find((x) => x.parents.includes("mom"))!;
    expect(el.edges.filter((e) => e.target === dadU.id).map((e) => e.source).sort()).toEqual(["dad", "mom"]);
    expect(el.edges.filter((e) => e.source === dadU.id).map((e) => e.target).sort()).toEqual(["a", "b"]);
    // mọi cạnh trỏ tới nút tồn tại
    const ids = new Set(el.nodes.map((n) => n.id));
    expect(el.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
  });
  it("con có cha mẹ ruột + kế: cạnh con được đánh dấu không ruột", () => {
    const ix2 = buildIndex([P("a", "A"), P("b", "B"), P("c", "C")], [L("c", "a"), L("c", "b", "step")], []);
    expect(buildElements(ix2).edges.find((e) => e.target === "c")!.kind).toBe("step");
  });
});

describe("computeGenerations", () => {
  const gens = computeGenerations(buildIndex(people, links, partners));
  it("tính đời từ gốc", () => {
    expect(gens.get("gp")).toBe(1);
    expect(gens.get("dad")).toBe(2);
    expect(gens.get("a")).toBe(3);
  });
  it("người kết hôn vào lấy đời của vợ/chồng", () => {
    expect(gens.get("mom")).toBe(2);
  });
  it("không treo khi dữ liệu có vòng lặp", () => {
    const ix = buildIndex([P("a", "A"), P("b", "B")], [L("a", "b"), L("b", "a")], []);
    expect(computeGenerations(ix).size).toBe(2);
  });
  it("con của người kết hôn vào được đẩy xuống đúng đời", () => {
    const ix = buildIndex(
      [P("r", "R"), P("c", "C"), P("s", "S"), P("k", "K")],
      [L("c", "r"), L("k", "s")],
      [M("c", "s")],
    );
    const g = computeGenerations(ix);
    expect(g.get("s")).toBe(2);
    expect(g.get("k")).toBe(3);
  });
});

describe("siblingsOf", () => {
  it("anh chị em ruột và cùng cha khác mẹ", () => {
    const ps = [P("f", "F"), P("m1", "M1"), P("m2", "M2"), P("x", "X", 2000), P("y", "Y", 2001), P("z", "Z", 2005)];
    const ls = [L("x", "f"), L("x", "m1"), L("y", "f"), L("y", "m1"), L("z", "f"), L("z", "m2")];
    const ix = buildIndex(ps, ls, []);
    expect(siblingsOf(ix, "x")).toEqual([{ id: "y", full: true }, { id: "z", full: false }]);
    expect(siblingsOf(ix, "f")).toEqual([]);
  });
  it("không có cha mẹ thì không có anh chị em", () => {
    expect(siblingsOf(buildIndex(people, links, partners), "gp")).toEqual([]);
  });
});

describe("buildOutline", () => {
  const outline = buildOutline(buildIndex(people, links, partners));
  it("mỗi người xuất hiện đúng một lần, kể cả người kết hôn vào", () => {
    const shown = new Set<string>();
    for (const it of outline) { shown.add(it.id); for (const s of it.spouses) if (s.shownHere) shown.add(s.id); }
    expect([...shown].sort()).toEqual(people.map((p) => p.id).sort());
    const counts = new Map<string, number>();
    for (const it of outline) counts.set(it.id, (counts.get(it.id) ?? 0) + 1);
    expect([...counts.values()].every((n) => n === 1)).toBe(true);
  });
  it("thụt lề theo đời và con xếp theo năm sinh", () => {
    expect(outline.map((o) => [o.id, o.depth])).toEqual([["gp", 0], ["dad", 1], ["a", 2], ["b", 2], ["uncle", 1]]);
  });
  it("vợ/chồng ghi cạnh người kia kèm tình trạng", () => {
    const gpItem = outline.find((o) => o.id === "gp")!;
    expect(gpItem.spouses).toEqual([{ id: "gm", status: "married", shownHere: true }]);
  });
  it("con của người kết hôn vào xuất hiện dưới dòng của vợ/chồng", () => {
    const ix = buildIndex([P("c", "C", 1990), P("s", "S", 1991), P("k", "K", 2020)], [L("k", "s")], [M("c", "s")]);
    const o = buildOutline(ix);
    expect(o.map((x) => x.id)).toEqual(["c", "k"]);
    expect(o[1].depth).toBe(1);
  });
  it("vòng kết hôn chéo không làm sót ai và không lặp vô hạn", () => {
    const ps = [P("z1", "Z1"), P("w1", "W1"), P("z2", "Z2"), P("w2", "W2")];
    const ix = buildIndex(ps, [L("w1", "z2"), L("w2", "z1")], [M("z1", "w1"), M("z2", "w2")]);
    const shown = new Set<string>();
    for (const it of buildOutline(ix)) { shown.add(it.id); it.spouses.forEach((s) => s.shownHere && shown.add(s.id)); }
    expect(shown.size).toBe(4);
  });
  it("người không có quan hệ nào vẫn hiện", () => {
    const o = buildOutline(buildIndex([P("solo", "Solo")], [], []));
    expect(o).toEqual([{ id: "solo", depth: 0, spouses: [], kind: null }]);
  });
});

describe("lọc theo nhánh", () => {
  it("branchWithDescendants gồm nhánh con nhiều cấp", () => {
    const bs = [{ id: "A", parent_branch_id: null }, { id: "A1", parent_branch_id: "A" }, { id: "A2", parent_branch_id: "A1" }, { id: "B", parent_branch_id: null }];
    expect([...branchWithDescendants(bs, "A")].sort()).toEqual(["A", "A1", "A2"]);
    expect([...branchWithDescendants(bs, "B")]).toEqual(["B"]);
  });
  it("giữ người thuộc nhánh + vợ/chồng + cha mẹ trực tiếp", () => {
    const r = filterByBranch(people, links, partners, new Set(["B"]));
    expect([...r.core]).toEqual(["b"]);
    expect(r.people.map((p) => p.id).sort()).toEqual(["b", "dad", "mom"]);
    expect(r.links.map((l) => l.id).sort()).toEqual(["b>dad", "b>mom"]);
    expect(r.partners).toHaveLength(1);
  });
  it("lọc 'chưa xếp nhánh'", () => {
    const r = filterByBranch(people, links, partners, "none");
    expect([...r.core].sort()).toEqual(["gm", "gp", "mom"]);
  });
  it("kết quả lọc dựng được đồ thị nhất quán", () => {
    const r = filterByBranch(people, links, partners, new Set(["A"]));
    const el = buildElements(buildIndex(r.people, r.links, r.partners));
    const ids = new Set(el.nodes.map((n) => n.id));
    expect(el.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
  });
});

describe("searchPeople", () => {
  const ps = [P("1", "Nguyễn Văn An"), P("2", "Trần Thị Ánh"), P("3", "Đặng Văn Nam"), { ...P("4", "Lê Văn B"), nick: "Cu Tí" }];
  it("không phân biệt dấu và hoa thường", () => {
    expect(searchPeople(ps, "nguyen").map((p) => p.id)).toEqual(["1"]);
    expect(searchPeople(ps, "DANG").map((p) => p.id)).toEqual(["3"]);
    expect(searchPeople(ps, "anh").map((p) => p.id)).toEqual(["2"]);
  });
  it("khớp tên thường gọi, ưu tiên khớp đầu từ", () => {
    expect(searchPeople(ps, "ti").map((p) => p.id)).toContain("4");
    expect(searchPeople(ps, "an").map((p) => p.id)[0]).toBe("1");
  });
  it("chuỗi rỗng trả về rỗng; giới hạn số kết quả", () => {
    expect(searchPeople(ps, "  ")).toEqual([]);
    expect(searchPeople(ps, "van", 2)).toHaveLength(2);
  });
});
