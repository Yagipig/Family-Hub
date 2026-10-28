import { describe, expect, it } from "vitest";
import { normalizeSearch, safeHref, splitLinks, unreadLabel } from "./chat-text";

describe("splitLinks", () => {
  it("giữ nguyên văn bản không có liên kết", () => {
    expect(splitLinks("Chào cả nhà <b>không phải HTML</b>")).toEqual([{ type: "text", text: "Chào cả nhà <b>không phải HTML</b>" }]);
  });
  it("nhận dạng liên kết https và bỏ dấu câu cuối", () => {
    expect(splitLinks("Xem https://example.com/a?b=1, nhé")).toEqual([
      { type: "text", text: "Xem " },
      { type: "link", text: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { type: "text", text: ", nhé" },
    ]);
  });
  it("giữ dấu ) khi liên kết có ( tương ứng, bỏ khi không", () => {
    const a = splitLinks("(xem https://vi.wikipedia.org/wiki/A_(B))");
    expect(a.find((s) => s.type === "link")).toMatchObject({ text: "https://vi.wikipedia.org/wiki/A_(B)" });
    const b = splitLinks("(xem https://example.com/x)");
    expect(b.find((s) => s.type === "link")).toMatchObject({ text: "https://example.com/x" });
  });
  it("không biến javascript:, data:, ftp: thành liên kết", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html;base64,AAAA", "ftp://example.com/x", "vbscript:x"]) {
      expect(splitLinks(bad).every((s) => s.type === "text")).toBe(true);
    }
  });
  it("không linkify http chứa tên đăng nhập (lừa đảo)", () => {
    expect(splitLinks("https://ngan-hang.vn@trang-gia.com/login").every((s) => s.type === "text")).toBe(true);
  });
  it("không linkify tên miền xn-- (giả mạo ký tự)", () => {
    expect(splitLinks("https://xn--pple-43d.com").every((s) => s.type === "text")).toBe(true);
  });
  it("không linkify host không có dấu chấm (localhost/ip nội bộ dạng tên)", () => {
    expect(splitLinks("http://localhost:3000/admin").every((s) => s.type === "text")).toBe(true);
  });
  it("nhiều liên kết trong một tin, nối lại đúng nội dung gốc", () => {
    const body = "A https://a.example.com B http://b.example.org/x C";
    const segs = splitLinks(body);
    expect(segs.filter((s) => s.type === "link")).toHaveLength(2);
    expect(segs.map((s) => s.text).join("")).toBe(body);
  });
  it("liên kết quá dài không bị linkify", () => {
    expect(splitLinks("https://example.com/" + "a".repeat(2100)).every((s) => s.type === "text")).toBe(true);
  });
  it("href là dạng chuẩn hoá và chỉ http/https", () => {
    for (const s of splitLinks("https://Example.COM/Path#x")) if (s.type === "link") expect(s.href).toMatch(/^https?:\/\//);
  });
});

describe("safeHref", () => {
  it("từ chối chuỗi rỗng và không phải URL", () => {
    expect(safeHref("")).toBeNull();
    expect(safeHref("not a url")).toBeNull();
  });
  it("chấp nhận http/https hợp lệ", () => {
    expect(safeHref("https://gia-pha.vn/tin")).toBe("https://gia-pha.vn/tin");
  });
});

describe("normalizeSearch", () => {
  it("bỏ dấu tiếng Việt và đ", () => {
    expect(normalizeSearch("Nhánh Đông – Tư")).toBe("nhanh dong – tu");
    expect(normalizeSearch("  ĐÀ LẠT ")).toBe("da lat");
  });
});

describe("unreadLabel", () => {
  it("gọn khi từ 100", () => {
    expect(unreadLabel(3)).toBe("3");
    expect(unreadLabel(100)).toBe("99+");
  });
});
