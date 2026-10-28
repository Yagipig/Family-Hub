import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { ImageRejected, processImage, processMain, processThumb } from "./image-process";
import { MAX_UPLOAD_BYTES } from "./media-core";

const solid = (w: number, h: number, ch: 3 | 4 = 3) =>
  sharp({ create: { width: w, height: h, channels: ch, background: ch === 4 ? { r: 10, g: 120, b: 200, alpha: 0.5 } : { r: 200, g: 30, b: 30 } } });

async function jpegWithGps(w = 3000, h = 2000, orientation?: number) {
  let img = solid(w, h).jpeg({ quality: 90 }).withExif({
    IFD0: { Make: "TestPhone", Model: "X1", Copyright: "rieng-tu" },
    IFD3: { GPSLatitudeRef: "N", GPSLatitude: "10/1 46/1 30/1", GPSLongitudeRef: "E", GPSLongitude: "106/1 41/1 0/1" },
  });
  if (orientation) img = img.withMetadata({ orientation });
  return img.toBuffer();
}

describe("processImage: bỏ EXIF / GPS bằng cách vẽ lại ảnh", () => {
  it("ảnh gốc có EXIF + GPS; ảnh đầu ra KHÔNG còn metadata và nhỏ hơn 2048 px", async () => {
    const src = await jpegWithGps();
    const before = await sharp(src).metadata();
    expect(before.exif).toBeDefined(); // tiền đề: ảnh thử thật sự có EXIF
    expect(before.exif!.toString("latin1")).toContain("TestPhone");

    const out = await processMain(src, "album");
    const after = await sharp(out.buffer).metadata();
    expect(after.exif).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(after.iptc).toBeUndefined();
    expect(out.buffer.toString("latin1")).not.toContain("TestPhone");
    expect(out.buffer.toString("latin1")).not.toContain("GPS");
    expect(Math.max(out.width, out.height)).toBe(2048);
    expect(out.mime).toBe("image/jpeg");
    expect(out.bytes).toBe(out.buffer.length);
    expect(out.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("áp dụng hướng xoay EXIF rồi bỏ nó (ảnh dọc không bị nằm ngang)", async () => {
    const src = await jpegWithGps(600, 400, 6); // Orientation 6 = xoay 90 độ
    expect((await sharp(src).metadata()).orientation).toBe(6);
    const out = await processImage(src, { maxEdge: 2048 });
    expect(out.width).toBe(400);
    expect(out.height).toBe(600);
    expect((await sharp(out.buffer).metadata()).orientation).toBeUndefined();
  });

  it("không phóng to ảnh nhỏ", async () => {
    const src = await solid(300, 200).jpeg().toBuffer();
    const out = await processMain(src, "post");
    expect([out.width, out.height]).toEqual([300, 200]);
  });

  it("PNG có nền trong suốt -> WebP, giữ kênh alpha", async () => {
    const src = await solid(100, 80, 4).png().toBuffer();
    const out = await processImage(src, { maxEdge: 2048 });
    expect(out.mime).toBe("image/webp");
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.hasAlpha).toBe(true);
  });

  it("ảnh đại diện: cắt vuông 512x512", async () => {
    const src = await solid(1200, 800).jpeg().toBuffer();
    const out = await processMain(src, "avatar");
    expect([out.width, out.height]).toEqual([512, 512]);
  });

  it("ảnh thu nhỏ 480 px, ép cùng định dạng với ảnh chính", async () => {
    const src = await solid(2000, 1000, 4).png().toBuffer();
    const t = await processThumb(src, "webp");
    expect(Math.max(t.width, t.height)).toBe(480);
    expect(t.mime).toBe("image/webp");
    const jpg = await processThumb(await solid(2000, 1000).jpeg().toBuffer(), "jpeg");
    expect(jpg.mime).toBe("image/jpeg");
    // ép JPEG từ nguồn PNG
    const forced = await processThumb(src, "jpeg");
    expect(forced.mime).toBe("image/jpeg");
    expect((await sharp(forced.buffer).metadata()).format).toBe("jpeg");
  });
});

describe("processImage: từ chối đầu vào không an toàn", () => {
  const code = async (p: Promise<unknown>) => {
    try { await p; } catch (e) { return e instanceof ImageRejected ? e.code : `lỗi khác: ${String(e)}`; }
    return "KHÔNG BỊ TỪ CHỐI";
  };

  it("SVG (kể cả đội lốt đuôi .jpg) bị từ chối", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>');
    expect(await code(processImage(svg, { maxEdge: 2048 }))).toBe("unsupported");
  });
  it("GIF, PDF, HTML, byte ngẫu nhiên bị từ chối", async () => {
    expect(await code(processImage(Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;", "latin1"), { maxEdge: 100 }))).toBe("unsupported");
    expect(await code(processImage(Buffer.from("%PDF-1.4 ..."), { maxEdge: 100 }))).toBe("unsupported");
    expect(await code(processImage(Buffer.from("<html><body>hi</body></html>"), { maxEdge: 100 }))).toBe("unsupported");
    expect(await code(processImage(Buffer.from(Array.from({ length: 200 }, (_, i) => (i * 37) % 251)), { maxEdge: 100 }))).toBe("unsupported");
  });
  it("tệp rỗng và tệp quá lớn bị từ chối", async () => {
    expect(await code(processImage(Buffer.alloc(0), { maxEdge: 100 }))).toBe("empty");
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_UPLOAD_BYTES)]);
    expect(await code(processImage(big, { maxEdge: 100 }))).toBe("too_large");
  });
  it("JPEG hỏng (đúng magic bytes nhưng ruột rác) bị từ chối", async () => {
    const bad = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("rac-khong-phai-anh".repeat(20))]);
    expect(await code(processImage(bad, { maxEdge: 100 }))).toBe("corrupt");
  });
  it("ảnh vượt giới hạn số điểm ảnh bị từ chối (chống bom giải nén)", async () => {
    const huge = await sharp({ create: { width: 8000, height: 7000, channels: 3, background: "#fff" } }).png({ compressionLevel: 9 }).toBuffer();
    if (huge.length > MAX_UPLOAD_BYTES) return; // môi trường lạ: không kiểm tra được
    expect(await code(processImage(huge, { maxEdge: 2048 }))).toBe("too_many_pixels");
  });
});

describe("processImage: thiếu sharp thì TỪ CHỐI (không lưu ảnh còn EXIF)", () => {
  it("báo no_processor khi không nạp được sharp", async () => {
    vi.resetModules();
    vi.doMock("sharp", () => { throw new Error("khong co sharp"); });
    const mod = await import("./image-process");
    const src = await solid(100, 100).jpeg().toBuffer();
    await expect(mod.processImage(src, { maxEdge: 2048 })).rejects.toMatchObject({ code: "no_processor" });
    vi.doUnmock("sharp");
    vi.resetModules();
  });
});
