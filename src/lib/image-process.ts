/**
 * Xử lý ảnh phía MÁY CHỦ trước khi lưu vào Storage (chỉ import từ route handler / server action, không import vào client).
 *  - Nhận dạng định dạng bằng magic bytes (từ chối SVG, GIF, HEIC, tệp lạ).
 *  - VẼ LẠI ảnh bằng sharp: xoay theo EXIF rồi bỏ toàn bộ EXIF / GPS / XMP / IPTC / hồ sơ màu; thu nhỏ; nén.
 *  - Nếu không xử lý được (thiếu sharp, ảnh hỏng, vẫn còn metadata) thì TỪ CHỐI, không bao giờ lưu ảnh gốc còn EXIF.
 */
import { createHash } from "node:crypto";
import type sharpType from "sharp";
import {
  AVATAR_EDGE, IMAGE_QUALITY, MAIN_MAX_EDGE, MAX_UPLOAD_BYTES, MIME_BY_TYPE, THUMB_EDGE, detectImageType,
  type AllowedMime,
} from "./media-core";

export type RejectCode = "empty" | "too_large" | "unsupported" | "corrupt" | "too_many_pixels" | "no_processor" | "metadata_left";

export class ImageRejected extends Error {
  constructor(public readonly code: RejectCode, message: string) {
    super(message);
    this.name = "ImageRejected";
  }
}

export const REJECT_MESSAGES: Record<RejectCode, string> = {
  empty: "Tệp ảnh trống.",
  too_large: "Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 4 MB (ứng dụng thường tự thu nhỏ ảnh giúp bạn).",
  unsupported: "Chỉ nhận ảnh JPG, PNG hoặc WebP.",
  corrupt: "Không đọc được ảnh này. Vui lòng thử ảnh khác.",
  too_many_pixels: "Ảnh có độ phân giải quá lớn. Vui lòng chọn ảnh nhỏ hơn.",
  no_processor: "Máy chủ chưa xử lý được ảnh nên chưa thể tải lên. Vui lòng báo quản trị viên.",
  metadata_left: "Không xóa được thông tin vị trí khỏi ảnh nên đã từ chối để bảo vệ riêng tư.",
};

export type ProcessedImage = {
  buffer: Buffer;
  mime: AllowedMime;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export type ProcessOptions = {
  /** Cạnh dài tối đa (px). */
  maxEdge: number;
  /** Cắt vuông giữa ảnh (ảnh đại diện). */
  square?: boolean;
  /** 0..1, mặc định 0,82. */
  quality?: number;
  /** Ép định dạng đầu ra (ảnh thu nhỏ phải cùng định dạng với ảnh chính). Mặc định: JPEG giữ JPEG, còn lại WebP. */
  format?: "jpeg" | "webp";
};

type SharpFn = typeof sharpType;
let sharpPromise: Promise<SharpFn> | null = null;
async function loadSharp(): Promise<SharpFn> {
  sharpPromise ??= import("sharp").then((m) => (m as unknown as { default: SharpFn }).default ?? (m as unknown as SharpFn));
  try {
    return await sharpPromise;
  } catch {
    sharpPromise = null;
    throw new ImageRejected("no_processor", REJECT_MESSAGES.no_processor);
  }
}

const MAX_INPUT_PIXELS = 50_000_000;

/** Vẽ lại ảnh: bỏ metadata, thu nhỏ, nén. Ném ImageRejected nếu không đảm bảo được an toàn. */
export async function processImage(input: Buffer, opts: ProcessOptions): Promise<ProcessedImage> {
  if (input.length === 0) throw new ImageRejected("empty", REJECT_MESSAGES.empty);
  if (input.length > MAX_UPLOAD_BYTES) throw new ImageRejected("too_large", REJECT_MESSAGES.too_large);
  const type = detectImageType(input);
  if (!type) throw new ImageRejected("unsupported", REJECT_MESSAGES.unsupported);

  const sharp = await loadSharp();
  const toJpeg = opts.format ? opts.format === "jpeg" : type === "jpeg";
  const mime: AllowedMime = toJpeg ? MIME_BY_TYPE.jpeg : MIME_BY_TYPE.webp;
  const q0 = Math.round((opts.quality ?? IMAGE_QUALITY) * 100);

  let result: { data: Buffer; info: { width: number; height: number } } | null = null;
  // Nếu vẫn lớn hơn giới hạn thì giảm dần chất lượng
  for (const q of [q0, Math.round(q0 * 0.85), Math.round(q0 * 0.7), Math.round(q0 * 0.55)]) {
    try {
      let img = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", animated: false })
        .rotate() // áp dụng hướng xoay trong EXIF rồi bỏ EXIF (sharp mặc định không giữ metadata)
        .resize({
          width: opts.maxEdge,
          height: opts.maxEdge,
          fit: opts.square ? "cover" : "inside",
          withoutEnlargement: true,
        });
      img = toJpeg ? img.jpeg({ quality: q, mozjpeg: true, progressive: true }) : img.webp({ quality: q });
      const out = await img.toBuffer({ resolveWithObject: true });
      result = { data: out.data, info: { width: out.info.width, height: out.info.height } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/pixel limit|exceeds/i.test(msg)) throw new ImageRejected("too_many_pixels", REJECT_MESSAGES.too_many_pixels);
      throw new ImageRejected("corrupt", REJECT_MESSAGES.corrupt);
    }
    if (result.data.length <= MAX_UPLOAD_BYTES) break;
  }
  if (!result || result.data.length > MAX_UPLOAD_BYTES) throw new ImageRejected("too_large", REJECT_MESSAGES.too_large);

  // Kiểm tra lại: ảnh đầu ra phải không còn EXIF / XMP / IPTC (đóng cửa an toàn)
  try {
    const m = await sharp(result.data).metadata();
    if (m.exif || m.xmp || m.iptc || m.tifftagPhotoshop) throw new ImageRejected("metadata_left", REJECT_MESSAGES.metadata_left);
    if (!m.width || !m.height) throw new ImageRejected("corrupt", REJECT_MESSAGES.corrupt);
  } catch (e) {
    if (e instanceof ImageRejected) throw e;
    throw new ImageRejected("corrupt", REJECT_MESSAGES.corrupt);
  }

  return {
    buffer: result.data,
    mime,
    width: result.info.width,
    height: result.info.height,
    bytes: result.data.length,
    sha256: createHash("sha256").update(result.data).digest("hex"),
  };
}

export const processMain = (input: Buffer, kind: "avatar" | "cover" | "album" | "post") =>
  kind === "avatar"
    ? processImage(input, { maxEdge: AVATAR_EDGE, square: true })
    : processImage(input, { maxEdge: MAIN_MAX_EDGE });

export const processThumb = (input: Buffer, format: "jpeg" | "webp") =>
  processImage(input, { maxEdge: THUMB_EDGE, quality: 0.75, format });
