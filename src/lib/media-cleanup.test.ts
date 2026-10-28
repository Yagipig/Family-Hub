import { describe, expect, it } from "vitest";
import { isCronAuthorized, runMediaCleanup, type CleanupAdmin } from "./media-cleanup";

const SECRET = "bi-mat-cron-dai-hon-16-ky-tu";

describe("isCronAuthorized", () => {
  it("chỉ chấp nhận đúng 'Bearer <CRON_SECRET>'", () => {
    expect(isCronAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isCronAuthorized(`bearer ${SECRET}`, SECRET)).toBe(false);
    expect(isCronAuthorized(SECRET, SECRET)).toBe(false);
    expect(isCronAuthorized("Bearer sai", SECRET)).toBe(false);
    expect(isCronAuthorized(null, SECRET)).toBe(false);
    expect(isCronAuthorized("", SECRET)).toBe(false);
  });
  it("thiếu hoặc quá ngắn CRON_SECRET => từ chối mọi yêu cầu (kể cả Authorization rỗng/khớp)", () => {
    expect(isCronAuthorized("Bearer ", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer abc", "abc")).toBe(false);
    expect(isCronAuthorized("", "")).toBe(false);
  });
});

function fakeAdmin(rows: { id: string; bucket: string; path: string; thumb_path: string | null }[][], opts: { removeFail?: string; finishFail?: boolean; listFail?: boolean } = {}) {
  const log: string[] = [];
  const removed: Record<string, string[]> = {};
  let round = 0;
  const admin: CleanupAdmin = {
    async rpc(fn, args) {
      log.push(fn);
      if (fn === "media_cleanup_list") {
        if (opts.listFail) return { data: null, error: { message: "x" } };
        return { data: rows[round++] ?? [], error: null };
      }
      if (opts.finishFail) return { data: null, error: { message: "x" } };
      return { data: (args.p_ids as string[]).length, error: null };
    },
    storage: {
      from: (bucket) => ({
        async remove(paths) {
          log.push(`remove:${bucket}`);
          if (opts.removeFail === bucket) return { error: { message: "down" } };
          (removed[bucket] ??= []).push(...paths);
          return { error: null };
        },
      }),
    },
  };
  return { admin, log, removed };
}

describe("runMediaCleanup", () => {
  const A = { id: "a", bucket: "family-media", path: "f/album/m/a.jpg", thumb_path: "f/album/m/a_t.jpg" };
  const B = { id: "b", bucket: "avatars", path: "f/avatar/m/b.jpg", thumb_path: null };

  it("xóa tệp thật (cả ảnh thu nhỏ) theo từng bucket rồi mới đánh dấu đã dọn", async () => {
    const { admin, log, removed } = fakeAdmin([[A, B]]);
    const res = await runMediaCleanup(admin);
    expect(res).toEqual({ ok: true, purged: 2, failed: 0 });
    expect(removed["family-media"]).toEqual(["f/album/m/a.jpg", "f/album/m/a_t.jpg"]);
    expect(removed["avatars"]).toEqual(["f/avatar/m/b.jpg"]);
    expect(log.indexOf("media_cleanup_finish")).toBeGreaterThan(log.lastIndexOf("remove:avatars"));
  });

  it("Storage lỗi ở một bucket: chỉ đánh dấu dọn phần đã xóa được, phần lỗi để thử lại", async () => {
    const { admin } = fakeAdmin([[A, B]], { removeFail: "avatars" });
    const res = await runMediaCleanup(admin);
    expect(res).toEqual({ ok: true, purged: 1, failed: 1 });
  });

  it("Storage lỗi hết: không gọi finish, dừng ngay", async () => {
    const { admin, log } = fakeAdmin([[A], [A]], { removeFail: "family-media" });
    const res = await runMediaCleanup(admin);
    expect(res.purged).toBe(0);
    expect(res.failed).toBe(1);
    expect(log).not.toContain("media_cleanup_finish");
    expect(log.filter((l) => l === "media_cleanup_list")).toHaveLength(1);
  });

  it("không có gì cần dọn; lỗi đọc danh sách / lỗi finish được báo", async () => {
    expect(await runMediaCleanup(fakeAdmin([]).admin)).toEqual({ ok: true, purged: 0, failed: 0 });
    expect((await runMediaCleanup(fakeAdmin([], { listFail: true }).admin)).ok).toBe(false);
    expect((await runMediaCleanup(fakeAdmin([[A]], { finishFail: true }).admin)).ok).toBe(false);
  });
});
