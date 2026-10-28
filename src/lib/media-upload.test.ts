import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { handleUpload, type UploadSupabase } from "./media-upload";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const MEMBER = "22222222-2222-4222-8222-222222222222";
const ALBUM = "33333333-3333-4333-8333-333333333333";
const MID = "44444444-4444-4444-8444-444444444444";

type Call = { fn: string; args: Record<string, unknown> };
type Upload = { bucket: string; path: string; body: Buffer; contentType: string; upsert: boolean };

function fake(opts: {
  begin?: { data: unknown; error: { code?: string; message?: string } | null };
  uploadFail?: (path: string) => boolean;
  finalizeError?: { code?: string; message?: string };
  addItemError?: { code?: string; message?: string };
  thumb?: boolean;
} = {}) {
  const calls: Call[] = [];
  const uploads: Upload[] = [];
  const supabase: UploadSupabase = {
    async rpc(fn, args) {
      calls.push({ fn, args });
      if (fn === "begin_media_upload") {
        return opts.begin ?? {
          data: { id: MID, bucket: args.p_kind === "avatar" ? "avatars" : "family-media",
                  path: `${FAMILY}/${args.p_kind}/${MID}.jpg`, thumb_path: (args.p_thumb_bytes as number) > 0 ? `${FAMILY}/${args.p_kind}/${MID}_t.jpg` : null },
          error: null,
        };
      }
      if (fn === "finalize_media") return { data: null, error: opts.finalizeError ?? null };
      if (fn === "add_album_item") return { data: opts.addItemError ? null : "item-1", error: opts.addItemError ?? null };
      return { data: null, error: null };
    },
    storage: {
      from: (bucket) => ({
        async upload(path, body, o) {
          uploads.push({ bucket, path, body, contentType: o.contentType, upsert: o.upsert });
          return { error: opts.uploadFail?.(path) ? { message: "storage down" } : null };
        },
      }),
    },
  };
  return { supabase, calls, uploads };
}

const solid = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 20, g: 90, b: 160 } } });
async function jpegWithGps(w = 2600, h = 1800) {
  return solid(w, h).jpeg().withExif({ IFD0: { Make: "Phone", Model: "Z" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "10/1 0/1 0/1" } }).toBuffer();
}

function request(parts: Record<string, string | { name: string; type: string; data: Buffer }>, headers: Record<string, string> = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(parts)) {
    if (typeof v === "string") fd.set(k, v);
    else fd.set(k, new File([new Uint8Array(v.data)], v.name, { type: v.type }));
  }
  return new Request("http://localhost/api/media/upload", { method: "POST", body: fd, headers });
}
const img = (data: Buffer, type = "image/jpeg") => ({ name: "a.jpg", type, data });
const body = async (r: Response) => (await r.json()) as Record<string, unknown>;

describe("handleUpload", () => {
  it("chưa đăng nhập -> 401, không đụng tới CSDL", async () => {
    const f = fake();
    const res = await handleUpload(request({ kind: "post", file: img(await solid(10, 10).jpeg().toBuffer()) }), { familyId: null, supabase: f.supabase });
    expect(res.status).toBe(401);
    expect(f.calls).toHaveLength(0);
  });

  it("không phải multipart -> 400", async () => {
    const f = fake();
    const res = await handleUpload(new Request("http://x/u", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }), { familyId: FAMILY, supabase: f.supabase });
    expect(res.status).toBe(400);
  });

  it("thân quá lớn (khai báo hoặc thực tế) -> 413", async () => {
    const f = fake();
    const big = Buffer.alloc(5 * 1024 * 1024, 1);
    const r1 = await handleUpload(request({ kind: "post", file: img(big) }), { familyId: FAMILY, supabase: f.supabase });
    expect(r1.status).toBe(413);
    const fd = new FormData(); fd.set("kind", "post"); fd.set("file", new File([big], "a.jpg"));
    const raw = new Request("http://x/u", { method: "POST", body: fd });
    const ct = raw.headers.get("content-type")!;
    const buf = Buffer.from(await raw.arrayBuffer());
    const noLen = new Request("http://x/u", { method: "POST", body: buf, headers: { "content-type": ct } }); // không có Content-Length khai báo
    expect((await handleUpload(noLen, { familyId: FAMILY, supabase: f.supabase })).status).toBe(413);
    expect(f.calls).toHaveLength(0);
  });

  it("SVG đội lốt .jpg bị từ chối TRƯỚC khi chạm CSDL/Storage", async () => {
    const f = fake();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const res = await handleUpload(request({ kind: "post", file: img(svg, "image/jpeg") }), { familyId: FAMILY, supabase: f.supabase });
    expect(res.status).toBe(422);
    expect((await body(res)).code).toBe("unsupported");
    expect(f.calls).toHaveLength(0);
    expect(f.uploads).toHaveLength(0);
  });

  it("kiểm tra trường: loại lạ, thiếu memberId cho album, thiếu ảnh", async () => {
    const f = fake();
    const jpg = await solid(20, 20).jpeg().toBuffer();
    expect((await handleUpload(request({ kind: "svg", file: img(jpg) }), { familyId: FAMILY, supabase: f.supabase })).status).toBe(400);
    expect((await handleUpload(request({ kind: "album", file: img(jpg) }), { familyId: FAMILY, supabase: f.supabase })).status).toBe(400);
    expect((await handleUpload(request({ kind: "post" }), { familyId: FAMILY, supabase: f.supabase })).status).toBe(400);
    expect(f.calls).toHaveLength(0);
  });

  it("luồng đầy đủ cho album: ảnh lưu lên KHÔNG còn EXIF/GPS, đúng thứ tự begin -> upload -> finalize -> add_album_item", async () => {
    const f = fake();
    const src = await jpegWithGps();
    expect((await sharp(src).metadata()).exif).toBeDefined();
    const res = await handleUpload(
      request({ kind: "album", memberId: MEMBER, albumId: ALBUM, caption: "Tết 2020", takenOn: "2020-01-25", file: img(src) }),
      { familyId: FAMILY, supabase: f.supabase },
    );
    expect(res.status).toBe(200);
    const out = await body(res);
    expect(out).toMatchObject({ ok: true, mediaId: MID, itemId: "item-1" });

    expect(f.calls.map((c) => c.fn)).toEqual(["begin_media_upload", "finalize_media", "add_album_item"]);
    expect(f.uploads.map((u) => u.path)).toEqual([`${FAMILY}/album/${MID}.jpg`, `${FAMILY}/album/${MID}_t.jpg`]);
    for (const u of f.uploads) {
      expect(u.bucket).toBe("family-media");
      expect(u.upsert).toBe(false);
      expect(u.contentType).toBe("image/jpeg");
      const m = await sharp(u.body).metadata();
      expect(m.exif).toBeUndefined();
      expect(u.body.toString("latin1")).not.toContain("Phone");
    }
    const [main, thumb] = f.uploads;
    const mm = await sharp(main.body).metadata();
    expect(Math.max(mm.width!, mm.height!)).toBe(2048); // ảnh 2600x1800 được thu về cạnh dài 2048
    const tm = await sharp(thumb.body).metadata();
    expect(Math.max(tm.width!, tm.height!)).toBe(480);

    const begin = f.calls[0].args;
    expect(begin).toMatchObject({ p_family: FAMILY, p_kind: "album", p_member: MEMBER, p_mime: "image/jpeg" });
    expect(begin.p_bytes).toBe(main.body.length);          // số byte khai báo = số byte thật đã xử lý
    expect(begin.p_thumb_bytes).toBe(thumb.body.length);
    expect(f.calls[2].args).toMatchObject({ p_album: ALBUM, p_media: MID, p_caption: "Tết 2020", p_taken_on: "2020-01-25" });
  });

  it("ảnh đại diện: cắt vuông 512, không có ảnh thu nhỏ, lưu vào bucket avatars", async () => {
    const f = fake();
    const res = await handleUpload(request({ kind: "avatar", memberId: MEMBER, file: img(await solid(1000, 700).jpeg().toBuffer()) }), { familyId: FAMILY, supabase: f.supabase });
    expect(res.status).toBe(200);
    expect(f.uploads).toHaveLength(1);
    expect(f.uploads[0].bucket).toBe("avatars");
    const m = await sharp(f.uploads[0].body).metadata();
    expect([m.width, m.height]).toEqual([512, 512]);
    expect(f.calls[0].args.p_thumb_bytes).toBe(0);
    expect(f.calls.map((c) => c.fn)).toEqual(["begin_media_upload", "finalize_media"]);
  });

  it("ảnh thu nhỏ từ trình duyệt bị hỏng -> máy chủ tự tạo lại; thumb luôn cùng định dạng với ảnh chính", async () => {
    const f = fake();
    const png = await sharp({ create: { width: 800, height: 600, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } }).png().toBuffer();
    const res = await handleUpload(
      request({ kind: "post", file: img(png, "image/png"), thumb: { name: "t.jpg", type: "image/jpeg", data: Buffer.from("khong-phai-anh") } }),
      { familyId: FAMILY, supabase: f.supabase },
    );
    expect(res.status).toBe(200);
    expect(f.uploads).toHaveLength(2);
    expect((await sharp(f.uploads[0].body).metadata()).format).toBe("webp");
    expect((await sharp(f.uploads[1].body).metadata()).format).toBe("webp");
    expect(f.uploads[0].contentType).toBe("image/webp");
    expect(f.calls[0].args.p_mime).toBe("image/webp");
  });

  it("hết hạn mức -> 409 + thông báo tiếng Việt, không ghi gì vào Storage", async () => {
    const f = fake({ begin: { data: null, error: { code: "P0001", message: "media quota exceeded" } } });
    const res = await handleUpload(request({ kind: "post", file: img(await solid(50, 50).jpeg().toBuffer()) }), { familyId: FAMILY, supabase: f.supabase });
    expect(res.status).toBe(409);
    expect(String((await body(res)).error)).toMatch(/Kho ảnh/);
    expect(f.uploads).toHaveLength(0);
  });

  it("không đủ quyền -> 403; lỗi lạ không lộ chi tiết nội bộ", async () => {
    const f = fake({ begin: { data: null, error: { code: "42501", message: "forbidden" } } });
    const jpg = await solid(50, 50).jpeg().toBuffer();
    expect((await handleUpload(request({ kind: "cover", file: img(jpg) }), { familyId: FAMILY, supabase: f.supabase })).status).toBe(403);
    const g = fake({ begin: { data: null, error: { code: "XX000", message: "relation public.secret_table missing" } } });
    const r = await handleUpload(request({ kind: "post", file: img(jpg) }), { familyId: FAMILY, supabase: g.supabase });
    expect(JSON.stringify(await body(r))).not.toContain("secret_table");
  });

  it("Storage lỗi hoặc finalize lỗi -> hủy bản ghi chờ (cancel_media_upload)", async () => {
    const jpg = await solid(60, 60).jpeg().toBuffer();
    const a = fake({ uploadFail: () => true });
    const r1 = await handleUpload(request({ kind: "post", file: img(jpg) }), { familyId: FAMILY, supabase: a.supabase });
    expect(r1.status).toBe(502);
    expect(a.calls.map((c) => c.fn)).toEqual(["begin_media_upload", "cancel_media_upload"]);
    const b = fake({ uploadFail: (p) => p.endsWith("_t.jpg") });
    expect((await handleUpload(request({ kind: "post", file: img(jpg) }), { familyId: FAMILY, supabase: b.supabase })).status).toBe(502);
    expect(b.calls.map((c) => c.fn)).toEqual(["begin_media_upload", "cancel_media_upload"]);
    const c = fake({ finalizeError: { code: "22023", message: "uploaded file size mismatch" } });
    expect((await handleUpload(request({ kind: "post", file: img(jpg) }), { familyId: FAMILY, supabase: c.supabase })).status).toBe(502);
    expect(c.calls.map((x) => x.fn)).toEqual(["begin_media_upload", "finalize_media", "cancel_media_upload"]);
  });

  it("gắn vào album thất bại -> báo lỗi nhưng trả mediaId, KHÔNG hủy (ảnh đã lưu)", async () => {
    const f = fake({ addItemError: { code: "42501", message: "forbidden" } });
    const res = await handleUpload(
      request({ kind: "album", memberId: MEMBER, albumId: ALBUM, file: img(await solid(60, 60).jpeg().toBuffer()) }),
      { familyId: FAMILY, supabase: f.supabase },
    );
    expect(res.status).toBe(409);
    expect((await body(res)).mediaId).toBe(MID);
    expect(f.calls.map((c) => c.fn)).not.toContain("cancel_media_upload");
  });

  it("thiếu sharp -> 503 và KHÔNG lưu ảnh gốc (không gọi CSDL/Storage)", async () => {
    vi.resetModules();
    vi.doMock("sharp", () => { throw new Error("khong co sharp"); });
    const mod = await import("./media-upload");
    const f = fake();
    const jpg = await jpegWithGps(100, 100).catch(() => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0]));
    const res = await mod.handleUpload(request({ kind: "post", file: img(jpg) }), { familyId: FAMILY, supabase: f.supabase });
    expect(res.status).toBe(503);
    expect(f.calls).toHaveLength(0);
    expect(f.uploads).toHaveLength(0);
    vi.doUnmock("sharp");
    vi.resetModules();
  });
});
