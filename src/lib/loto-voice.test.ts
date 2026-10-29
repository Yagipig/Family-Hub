import { describe, expect, it } from "vitest";
import { packHasClip, type VoicePack } from "./loto-voice";

const pack: VoicePack = { numbers: new Set([7, 39, 90]), specials: new Set(["opening", "kinh"]) };

describe("Goi giong thu that (packHasClip)", () => {
  it("so da thu thi co clip, so chua thu thi khong", () => {
    expect(packHasClip(pack, "7")).toBe(true);
    expect(packHasClip(pack, "39")).toBe(true);
    expect(packHasClip(pack, "90")).toBe(true);
    expect(packHasClip(pack, "8")).toBe(false);
    expect(packHasClip(pack, "1")).toBe(false);
  });
  it("cau dac biet opening/kinh theo danh sach specials", () => {
    expect(packHasClip(pack, "opening")).toBe(true);
    expect(packHasClip(pack, "kinh")).toBe(true);
    expect(packHasClip(pack, "closing")).toBe(false);
  });
  it("ten khong hop le thi khong co clip", () => {
    expect(packHasClip(pack, "07")).toBe(false);
    expect(packHasClip(pack, "abc")).toBe(false);
    expect(packHasClip(pack, "")).toBe(false);
  });
});
