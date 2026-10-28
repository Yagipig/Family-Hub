import { describe, expect, it } from "vitest";
import { MAX_PATHS_PER_CALL, SignedUrlCache, isSignablePath, signUrlsCore, type SignClient } from "./storage-core";

const FID = "11111111-1111-4111-8111-111111111111";
const p = (n: number) => `${FID}/post/00000000-0000-4000-8000-${String(n).padStart(12, "0")}.jpg`;
const signed = (path: string) => `https://x.supabase.co/storage/v1/object/sign/family-media/${path}?token=t${path.length}`;

function fakeClient(opts: { deny?: Set<string>; publicFor?: Set<string>; fail?: boolean } = {}) {
  const calls: { bucket: string; paths: string[]; ttl: number }[] = [];
  const client: SignClient = {
    storage: {
      from: (bucket) => ({
        createSignedUrls: async (paths, ttl) => {
          calls.push({ bucket, paths, ttl });
          if (opts.fail) return { data: null, error: { message: "boom" } };
          return {
            data: paths.map((path) => {
              if (opts.deny?.has(path)) return { path, signedUrl: null, error: "Object not found" };
              if (opts.publicFor?.has(path)) return { path, signedUrl: `https://x.supabase.co/storage/v1/object/public/family-media/${path}`, error: null };
              return { path, signedUrl: signed(path), error: null };
            }),
            error: null,
          };
        },
      }),
    },
  };
  return { client, calls };
}

describe("signUrlsCore", () => {
  it("trả về URL đã ký cho đường dẫn đọc được", async () => {
    const { client } = fakeClient();
    const out = await signUrlsCore(client, new SignedUrlCache(), "u1", "family-media", [p(1), p(2)]);
    expect(Object.keys(out)).toHaveLength(2);
    expect(out[p(1)]).toContain("/object/sign/");
  });

  it("bỏ đường dẫn bị RLS từ chối (không có URL)", async () => {
    const { client } = fakeClient({ deny: new Set([p(2)]) });
    const out = await signUrlsCore(client, new SignedUrlCache(), "u1", "family-media", [p(1), p(2)]);
    expect(out[p(1)]).toBeDefined();
    expect(out[p(2)]).toBeUndefined();
  });

  it("KHÔNG BAO GIỜ trả URL công khai", async () => {
    const { client } = fakeClient({ publicFor: new Set([p(1)]) });
    const out = await signUrlsCore(client, new SignedUrlCache(), "u1", "family-media", [p(1)]);
    expect(out).toEqual({});
  });

  it("bỏ qua bucket lạ, đường dẫn dạng URL, '..', bắt đầu bằng '/', rỗng", async () => {
    const { client, calls } = fakeClient();
    expect(await signUrlsCore(client, new SignedUrlCache(), "u1", "public", [p(1)])).toEqual({});
    const out = await signUrlsCore(client, new SignedUrlCache(), "u1", "family-media",
      ["https://evil/x.jpg", `${FID}/../x.jpg`, `/${FID}/post/x.jpg`, "", null, undefined, "a?b=1", "data:image/png;base64,AAAA"]);
    expect(out).toEqual({});
    expect(calls.filter((c) => c.bucket === "family-media")).toHaveLength(0);
    expect(isSignablePath(p(1))).toBe(true);
  });

  it("không có người dùng thì không ký gì", async () => {
    const { client, calls } = fakeClient();
    expect(await signUrlsCore(client, new SignedUrlCache(), "", "family-media", [p(1)])).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it("dùng bộ nhớ đệm ngắn hạn: lần hai không gọi lại", async () => {
    const { client, calls } = fakeClient();
    const cache = new SignedUrlCache();
    const a = await signUrlsCore(client, cache, "u1", "family-media", [p(1)], 3600, 1_000);
    const b = await signUrlsCore(client, cache, "u1", "family-media", [p(1)], 3600, 2_000);
    expect(b).toEqual(a);
    expect(calls).toHaveLength(1);
  });

  it("bộ nhớ đệm KHÓA THEO NGƯỜI DÙNG: người khác không dùng lại URL đã ký", async () => {
    const { client, calls } = fakeClient();
    const cache = new SignedUrlCache();
    await signUrlsCore(client, cache, "u1", "family-media", [p(1)]);
    // u2 bị từ chối: phải hỏi lại Storage (RLS) và không nhận URL của u1
    const denied = fakeClient({ deny: new Set([p(1)]) });
    const out = await signUrlsCore(denied.client, cache, "u2", "family-media", [p(1)]);
    expect(out).toEqual({});
    expect(denied.calls).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it("URL gần hết hạn (còn < 50% ttl) được ký lại", async () => {
    const { client, calls } = fakeClient();
    const cache = new SignedUrlCache();
    await signUrlsCore(client, cache, "u1", "family-media", [p(1)], 3600, 0);
    await signUrlsCore(client, cache, "u1", "family-media", [p(1)], 3600, 1_000_000); // còn 2600 s > 1800 s
    expect(calls).toHaveLength(1);
    await signUrlsCore(client, cache, "u1", "family-media", [p(1)], 3600, 2_000_000); // còn 1600 s < 1800 s
    expect(calls).toHaveLength(2);
  });

  it("giới hạn ttl và chia nhóm khi quá nhiều đường dẫn; bỏ trùng", async () => {
    const { client, calls } = fakeClient();
    const many = Array.from({ length: MAX_PATHS_PER_CALL + 5 }, (_, i) => p(i + 1));
    const out = await signUrlsCore(client, new SignedUrlCache(), "u1", "family-media", [...many, ...many], 10 * 24 * 3600);
    expect(Object.keys(out)).toHaveLength(MAX_PATHS_PER_CALL + 5);
    expect(calls).toHaveLength(2);
    expect(calls[0].paths).toHaveLength(MAX_PATHS_PER_CALL);
    expect(calls.every((c) => c.ttl <= 24 * 3600)).toBe(true);
    const low = fakeClient();
    await signUrlsCore(low.client, new SignedUrlCache(), "u1", "family-media", [p(1)], 1);
    expect(low.calls[0].ttl).toBeGreaterThanOrEqual(60);
  });

  it("lỗi từ Storage thì trả về rỗng, không ném lỗi", async () => {
    const { client } = fakeClient({ fail: true });
    expect(await signUrlsCore(client, new SignedUrlCache(), "u1", "family-media", [p(1)])).toEqual({});
  });

  it("bộ nhớ đệm có giới hạn kích thước", () => {
    const c = new SignedUrlCache(3);
    for (let i = 0; i < 10; i++) c.set(`k${i}`, "u", 10_000);
    expect(c.size).toBe(3);
    expect(c.get("k0", 0, 0)).toBeNull(); // mục cũ nhất đã bị loại
    expect(c.get("k9", 0, 0)).toBe("u");
  });
});
