/**
 * Phía TRÌNH DUYỆT: nén ảnh bằng canvas trước khi tải lên (tối đa 2048 px, JPEG/WebP ~0,82) để tiết kiệm dung lượng gói miễn phí,
 * tạo ảnh thu nhỏ 480 px, và gửi lên /api/media/upload kèm tiến độ. Máy chủ vẫn kiểm tra và vẽ lại ảnh (không tin trình duyệt).
 */
import { AVATAR_EDGE, IMAGE_QUALITY, MAIN_MAX_EDGE, MAX_UPLOAD_BYTES, THUMB_EDGE, type MediaKind } from "./media-core";

export class UploadError extends Error {}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch { /* thử cách khác bên dưới */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new UploadError("Không đọc được ảnh này. Vui lòng chọn ảnh JPG, PNG hoặc WebP.");
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

export type CompressOptions = {
  maxEdge: number;
  quality?: number;
  /** Cắt vuông giữa ảnh (ảnh đại diện). */
  square?: boolean;
  /** Dung lượng mục tiêu tối đa (byte); mặc định ngay dưới giới hạn máy chủ. */
  maxBytes?: number;
};

/** Nén ảnh: JPEG gốc -> JPEG; PNG/WebP/khác -> WebP (nếu trình duyệt hỗ trợ), nếu không -> JPEG. */
export async function compressImage(file: Blob, opts: CompressOptions): Promise<Blob> {
  const dec = await decode(file);
  try {
    const limit = opts.maxBytes ?? MAX_UPLOAD_BYTES - 256 * 1024;
    const wantJpeg = file.type === "image/jpeg" || file.type === "";
    let edge = opts.maxEdge;
    let last: Blob | null = null;
    for (const attempt of [
      { q: opts.quality ?? IMAGE_QUALITY, scale: 1 }, { q: 0.72, scale: 1 }, { q: 0.62, scale: 0.8 }, { q: 0.5, scale: 0.6 },
    ]) {
      edge = Math.max(64, Math.round(opts.maxEdge * attempt.scale));
      const sw = dec.width, sh = dec.height;
      let sx = 0, sy = 0, cw = sw, ch = sh;
      if (opts.square) {
        const side = Math.min(sw, sh);
        sx = Math.floor((sw - side) / 2); sy = Math.floor((sh - side) / 2); cw = side; ch = side;
      }
      const scale = Math.min(1, edge / Math.max(cw, ch));
      const w = Math.max(1, Math.round(cw * scale)), h = Math.max(1, Math.round(ch * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new UploadError("Trình duyệt chưa hỗ trợ xử lý ảnh.");
      let type = wantJpeg ? "image/jpeg" : "image/webp";
      if (type === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(dec.source, sx, sy, cw, ch, 0, 0, w, h);
      let blob = await toBlob(canvas, type, attempt.q);
      if (!blob || blob.type !== type) { // trình duyệt không hỗ trợ WebP: dùng JPEG
        type = "image/jpeg";
        ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
        blob = await toBlob(canvas, type, attempt.q);
      }
      if (!blob) throw new UploadError("Không nén được ảnh. Vui lòng thử ảnh khác.");
      last = blob;
      if (blob.size <= limit) return blob;
    }
    if (last && last.size <= MAX_UPLOAD_BYTES) return last;
    throw new UploadError("Ảnh quá lớn, không thu nhỏ được. Vui lòng chọn ảnh khác.");
  } finally {
    dec.close();
  }
}

export const createThumbnail = (file: Blob) => compressImage(file, { maxEdge: THUMB_EDGE, quality: 0.75 });

export type UploadParams = {
  kind: MediaKind;
  memberId?: string | null;
  albumId?: string | null;
  caption?: string;
  takenOn?: string;
};
export type UploadResult = { mediaId: string; itemId: string | null; path: string; thumbPath: string | null };

/** Gửi một ảnh đã nén lên máy chủ, có tiến độ (0..1). */
export function uploadBlob(main: Blob, thumb: Blob | null, params: UploadParams, onProgress?: (p: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.set("kind", params.kind);
    fd.set("memberId", params.memberId ?? "");
    fd.set("albumId", params.albumId ?? "");
    fd.set("caption", params.caption ?? "");
    fd.set("takenOn", params.takenOn ?? "");
    fd.set("file", main, "anh");
    if (thumb) fd.set("thumb", thumb, "thu-nho");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media/upload");
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onerror = () => reject(new UploadError("Mất kết nối mạng. Vui lòng kiểm tra mạng và thử lại."));
    xhr.ontimeout = () => reject(new UploadError("Tải ảnh quá lâu. Vui lòng kiểm tra mạng và thử lại."));
    xhr.onload = () => {
      let body: { ok?: boolean; error?: string; mediaId?: string; itemId?: string | null; path?: string; thumbPath?: string | null } = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* giữ rỗng */ }
      if (xhr.status >= 200 && xhr.status < 300 && body.ok && body.mediaId) {
        onProgress?.(1);
        resolve({ mediaId: body.mediaId, itemId: body.itemId ?? null, path: body.path ?? "", thumbPath: body.thumbPath ?? null });
      } else if (xhr.status === 401) {
        reject(new UploadError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."));
      } else if (xhr.status === 413) {
        reject(new UploadError("Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn."));
      } else {
        reject(new UploadError(body.error ?? "Không tải được ảnh. Vui lòng thử lại."));
      }
    };
    xhr.send(fd);
  });
}

/** Nén + (tạo ảnh thu nhỏ) + tải lên. Ảnh đại diện: cắt vuông, không có ảnh thu nhỏ. */
export async function prepareAndUpload(file: File, params: UploadParams, onProgress?: (p: number) => void): Promise<UploadResult> {
  if (file.size === 0) throw new UploadError("Tệp ảnh trống.");
  if (file.size > 40 * 1024 * 1024) throw new UploadError("Ảnh gốc quá lớn (trên 40 MB).");
  const avatar = params.kind === "avatar";
  const main = await compressImage(file, avatar ? { maxEdge: AVATAR_EDGE, quality: 0.85, square: true } : { maxEdge: MAIN_MAX_EDGE });
  const thumb = avatar ? null : await createThumbnail(file).catch(() => null);
  return uploadBlob(main, thumb, params, onProgress);
}

export type QueueItem = {
  key: string;
  name: string;
  status: "queued" | "preparing" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  mediaId?: string;
};

/** Tải nhiều ảnh cùng lúc (tối đa `concurrency` ảnh song song), báo trạng thái từng ảnh. */
export async function uploadMany(
  files: File[], params: UploadParams, onUpdate: (items: QueueItem[]) => void, concurrency = 2,
): Promise<QueueItem[]> {
  const items: QueueItem[] = files.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, status: "queued", progress: 0 }));
  const push = () => onUpdate(items.map((x) => ({ ...x })));
  push();
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= files.length) return;
      const it = items[i];
      try {
        it.status = "preparing"; push();
        const r = await prepareAndUpload(files[i], params, (p) => { it.status = "uploading"; it.progress = p; push(); });
        it.status = "done"; it.progress = 1; it.mediaId = r.mediaId; push();
      } catch (e) {
        it.status = "error";
        it.error = e instanceof UploadError ? e.message : "Không tải được ảnh này.";
        push();
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, files.length)) }, worker));
  return items;
}
