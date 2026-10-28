import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { CryptoError, decrypt, encrypt, parseKey, payoutAad, getPayoutKey, payoutKeyConfigured } from "./crypto";

const keyB64 = () => randomBytes(32).toString("base64");
const key = () => parseKey(keyB64());

describe("crypto AES-256-GCM", () => {
  it("round-trip giữ nguyên nội dung (kể cả tiếng Việt, ký tự đặc biệt, chuỗi rỗng)", () => {
    const k = key();
    for (const text of ["Nguyễn Văn Ạ|0123456789", "日本語の口座 ✓", "", "a".repeat(5000), "tab\tnewline\n\"quote\""]) {
      const sealed = encrypt(text, k);
      expect(decrypt(sealed, k)).toBe(text);
    }
  });

  it("round-trip có AAD; sai AAD bị từ chối", () => {
    const k = key();
    const aad = payoutAad("p1", "u1");
    const sealed = encrypt("so-tai-khoan-123", k, aad);
    expect(decrypt(sealed, k, aad)).toBe("so-tai-khoan-123");
    expect(() => decrypt(sealed, k, payoutAad("p2", "u1"))).toThrow(CryptoError); // dán sang hồ sơ khác
    expect(() => decrypt(sealed, k, payoutAad("p1", "u2"))).toThrow(CryptoError); // đổi chủ sở hữu
    expect(() => decrypt(sealed, k)).toThrow(CryptoError); // thiếu AAD
  });

  it("giả mạo tag bị từ chối (đổi từng byte của tag)", () => {
    const k = key();
    const sealed = encrypt("bi mat", k);
    const tag = Buffer.from(sealed.tag, "base64");
    for (let i = 0; i < tag.length; i++) {
      const bad = Buffer.from(tag);
      bad[i] ^= 0x01;
      expect(() => decrypt({ ...sealed, tag: bad.toString("base64") }, k)).toThrow(CryptoError);
    }
  });

  it("giả mạo bản mã hoặc iv bị từ chối", () => {
    const k = key();
    const sealed = encrypt("bi mat 123456", k);
    const ct = Buffer.from(sealed.ciphertext, "base64");
    ct[0] ^= 0xff;
    expect(() => decrypt({ ...sealed, ciphertext: ct.toString("base64") }, k)).toThrow(CryptoError);
    const iv = Buffer.from(sealed.iv, "base64");
    iv[3] ^= 0x01;
    expect(() => decrypt({ ...sealed, iv: iv.toString("base64") }, k)).toThrow(CryptoError);
  });

  it("tag/iv sai độ dài hoặc sai định dạng bị từ chối (không chấp nhận tag cắt ngắn)", () => {
    const k = key();
    const sealed = encrypt("bi mat", k);
    const tag = Buffer.from(sealed.tag, "base64");
    expect(() => decrypt({ ...sealed, tag: tag.subarray(0, 4).toString("base64") }, k)).toThrow(CryptoError);
    expect(() => decrypt({ ...sealed, tag: "" }, k)).toThrow(CryptoError);
    expect(() => decrypt({ ...sealed, iv: Buffer.alloc(8).toString("base64") }, k)).toThrow(CryptoError);
    expect(() => decrypt({ ...sealed, iv: "khong phai base64!" }, k)).toThrow(CryptoError);
    expect(() => decrypt({ ...sealed, ciphertext: "***" }, k)).toThrow(CryptoError);
  });

  it("sai khóa bị từ chối; thông báo lỗi chung, không lộ nội dung", () => {
    const sealed = encrypt("MAT-KHAU-GIA-1234", key());
    try {
      decrypt(sealed, key());
      throw new Error("đáng lẽ phải ném lỗi");
    } catch (e) {
      expect(e).toBeInstanceOf(CryptoError);
      expect((e as Error).message).not.toContain("MAT-KHAU-GIA");
      expect((e as Error).message).not.toContain(sealed.ciphertext);
    }
  });

  it("iv không lặp: 20.000 lần mã hóa cùng một nội dung cho 20.000 iv khác nhau và bản mã khác nhau", () => {
    const k = key();
    const ivs = new Set<string>();
    const cts = new Set<string>();
    for (let i = 0; i < 20000; i++) {
      const s = encrypt("cung-mot-noi-dung", k);
      ivs.add(s.iv);
      cts.add(s.ciphertext);
      expect(Buffer.from(s.iv, "base64").length).toBe(12);
      expect(Buffer.from(s.tag, "base64").length).toBe(16);
    }
    expect(ivs.size).toBe(20000);
    expect(cts.size).toBe(20000);
  });

  it("bản mã không chứa bản rõ", () => {
    const k = key();
    const s = encrypt("0123456789012", k);
    expect(Buffer.from(s.ciphertext, "base64").toString("utf8")).not.toContain("0123456789012");
  });
});

describe("kiểm tra khóa", () => {
  it("chấp nhận khóa 32 byte base64", () => {
    expect(parseKey(keyB64())).toHaveLength(32);
    expect(parseKey("  " + keyB64() + "\n")).toHaveLength(32); // bỏ khoảng trắng đầu/cuối
  });
  it("từ chối khóa thiếu / rỗng / sai độ dài / sai base64 / quá yếu", () => {
    expect(() => parseKey(undefined)).toThrow(/Chưa cấu hình/);
    expect(() => parseKey("")).toThrow(CryptoError);
    expect(() => parseKey(randomBytes(16).toString("base64"))).toThrow(/32 byte/);
    expect(() => parseKey(randomBytes(33).toString("base64"))).toThrow(/32 byte/);
    expect(() => parseKey("không phải base64 !!!")).toThrow(CryptoError);
    expect(() => parseKey(Buffer.alloc(32, 7).toString("base64"))).toThrow(/yếu/);
    expect(() => parseKey(Buffer.alloc(32).toString("base64"))).toThrow(/yếu/);
  });
  it("lỗi khóa không lộ giá trị khóa", () => {
    const bad = randomBytes(20).toString("base64");
    try { parseKey(bad); } catch (e) { expect((e as Error).message).not.toContain(bad); }
  });
  it("getPayoutKey đọc PAYOUT_ENC_KEY từ môi trường", () => {
    const old = process.env.PAYOUT_ENC_KEY;
    try {
      delete process.env.PAYOUT_ENC_KEY;
      expect(payoutKeyConfigured()).toBe(false);
      expect(() => getPayoutKey()).toThrow(CryptoError);
      process.env.PAYOUT_ENC_KEY = keyB64();
      expect(payoutKeyConfigured()).toBe(true);
      expect(getPayoutKey()).toHaveLength(32);
      process.env.PAYOUT_ENC_KEY = "ngan";
      expect(payoutKeyConfigured()).toBe(false);
    } finally {
      if (old === undefined) delete process.env.PAYOUT_ENC_KEY; else process.env.PAYOUT_ENC_KEY = old;
    }
  });
  it("encrypt/decrypt từ chối khóa sai độ dài", () => {
    expect(() => encrypt("x", Buffer.alloc(16, 1))).toThrow(CryptoError);
    expect(() => decrypt({ ciphertext: "QUJD", iv: "AAAAAAAAAAAAAAAA", tag: "AAAAAAAAAAAAAAAAAAAAAA==" }, Buffer.alloc(16, 1))).toThrow(CryptoError);
  });
});
