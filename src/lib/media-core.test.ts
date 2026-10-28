import { describe, expect, it } from "vitest";
import {
  detectImageType, formatBytes, isSignedUrl, mediaErrorMessage, parseMediaPath, uploadFieldsSchema,
} from "./media-core";

const FID = "11111111-1111-4111-8111-111111111111";
const MID = "22222222-2222-4222-8222-222222222222";
const XID = "33333333-3333-4333-8333-333333333333";

describe("detectImageType (magic bytes)", () => {
  it("nhận JPEG, PNG, WebP theo nội dung", () => {
    expect(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe("jpeg");
    expect(detectImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe("png");
    expect(detectImageType(Buffer.from("RIFF\x24\x00\x00\x00WEBPVP8 ", "latin1"))).toBe("webp");
  });
  it("từ chối SVG, GIF, HEIC, PDF, rỗng, đuôi giả", () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageType(Buffer.from('<?xml version="1.0"?><svg/>'))).toBeNull();
    expect(detectImageType(Buffer.from("GIF89a\x01\x00\x01\x00", "latin1"))).toBeNull();
    expect(detectImageType(Buffer.from("\x00\x00\x00\x18ftypheic", "latin1"))).toBeNull();
    expect(detectImageType(Buffer.from("%PDF-1.7"))).toBeNull();
    expect(detectImageType(new Uint8Array(0))).toBeNull();
    expect(detectImageType(Uint8Array.from([0xff, 0xd8]))).toBeNull();
  });
  it("RIFF không phải WebP (ví dụ WAV) bị từ chối", () => {
    expect(detectImageType(Buffer.from("RIFF\x24\x00\x00\x00WAVEfmt ", "latin1"))).toBeNull();
  });
});

describe("parseMediaPath", () => {
  it("chấp nhận đường dẫn đúng mẫu", () => {
    expect(parseMediaPath(`${FID}/cover/${XID}.jpg`)).toEqual({ familyId: FID, kind: "cover", isThumb: false });
    expect(parseMediaPath(`${FID}/album/${MID}/${XID}_t.webp`)).toEqual({ familyId: FID, kind: "album", isThumb: true });
    expect(parseMediaPath(`${FID}/avatar/${MID}/${XID}.png`)?.kind).toBe("avatar");
    expect(parseMediaPath(`${FID}/post/${XID}.jpg`)?.kind).toBe("post");
  });
  it("từ chối đường dẫn sai mẫu / có thể gây lệch thư mục", () => {
    for (const bad of [
      "", "x.jpg", `${FID}/khac/${XID}.jpg`, `${FID}/post/${XID}.svg`, `${FID}/post/../${FID}/post/${XID}.jpg`,
      `/${FID}/post/${XID}.jpg`, `${FID}/post/${XID}.jpg/`, `${FID}/post/${XID}.jpg?x=1`, `${FID}/post/a/b/${XID}.jpg`,
      `https://evil.example/${FID}/post/${XID}.jpg`, "a".repeat(400),
    ]) expect(parseMediaPath(bad), bad).toBeNull();
  });
});

describe("isSignedUrl", () => {
  it("chỉ chấp nhận URL đã ký", () => {
    expect(isSignedUrl("https://abc.supabase.co/storage/v1/object/sign/family-media/x.jpg?token=eyJ")).toBe(true);
    expect(isSignedUrl("https://abc.supabase.co/storage/v1/object/public/family-media/x.jpg")).toBe(false);
    expect(isSignedUrl("https://abc.supabase.co/storage/v1/object/sign/family-media/x.jpg")).toBe(false);
    expect(isSignedUrl("khong-phai-url")).toBe(false);
  });
});

describe("uploadFieldsSchema", () => {
  it("avatar/album bắt buộc có memberId; cover/post thì không", () => {
    expect(uploadFieldsSchema.safeParse({ kind: "album", memberId: MID, albumId: "", caption: "", takenOn: "" }).success).toBe(true);
    expect(uploadFieldsSchema.safeParse({ kind: "album", memberId: "", albumId: "", caption: "", takenOn: "" }).success).toBe(false);
    expect(uploadFieldsSchema.safeParse({ kind: "post", memberId: MID, albumId: "", caption: "", takenOn: "" }).success).toBe(false);
    expect(uploadFieldsSchema.safeParse({ kind: "cover", memberId: "", albumId: "", caption: "", takenOn: "" }).success).toBe(true);
    expect(uploadFieldsSchema.safeParse({ kind: "svg", memberId: "", albumId: "", caption: "", takenOn: "" }).success).toBe(false);
  });
  it("kiểm tra chú thích và ngày", () => {
    const base = { kind: "album", memberId: MID, albumId: "", caption: "", takenOn: "" };
    expect(uploadFieldsSchema.safeParse({ ...base, caption: "x".repeat(301) }).success).toBe(false);
    expect(uploadFieldsSchema.safeParse({ ...base, takenOn: "01/02/2020" }).success).toBe(false);
    const ok = uploadFieldsSchema.parse({ ...base, takenOn: "2020-02-01", caption: "  Tết  " });
    expect(ok.takenOn).toBe("2020-02-01");
    expect(ok.caption).toBe("Tết");
    expect(ok.albumId).toBeNull();
  });
});

describe("mediaErrorMessage", () => {
  it("dịch lỗi hạn mức / giới hạn sang tiếng Việt", () => {
    expect(mediaErrorMessage({ code: "P0001", message: "media quota exceeded" })).toMatch(/Kho ảnh/);
    expect(mediaErrorMessage({ code: "22023", message: "unsupported mime type" })).toMatch(/JPG, PNG/);
    expect(mediaErrorMessage({ code: "42501", message: "forbidden" })).toMatch(/không có quyền/);
    expect(mediaErrorMessage({ code: "P0001", message: "too many posts, try later" })).toMatch(/đăng bài quá nhiều/);
  });
  it("không lộ lỗi lạ; trả null để dùng thông báo chung", () => {
    expect(mediaErrorMessage({ code: "XX000", message: "relation public.secret does not exist" })).toBeNull();
    expect(mediaErrorMessage(null)).toBeNull();
  });
});

describe("formatBytes", () => {
  it("định dạng dễ đọc", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(838860800)).toBe("800.0 MB");
    expect(formatBytes(-1)).toBe("—");
  });
});
