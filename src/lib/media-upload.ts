/**
 * Logic tải ảnh lên (tách khỏi route handler để kiểm thử bằng "supabase giả", không cần Next/Supabase thật).
 * Chỉ import tương đối. Xem ghi chú quy trình ở src/app/api/media/upload/route.ts.
 */
import { MAX_REQUEST_BYTES, mediaErrorMessage, uploadFieldsSchema, type MediaKind } from "./media-core";
import { ImageRejected, REJECT_MESSAGES, processMain, processThumb, type ProcessedImage } from "./image-process";

type RpcResult = PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
type StorageResult = PromiseLike<{ error: { message?: string } | null }>;

/** Phần tối thiểu của Supabase client mà quy trình cần (client thật của @supabase/ssr thỏa mãn). */
export type UploadSupabase = {
  rpc(fn: string, args: Record<string, unknown>): RpcResult;
  storage: {
    from(bucket: string): {
      upload(path: string, body: Buffer, opts: { contentType: string; cacheControl: string; upsert: boolean }): StorageResult;
    };
  };
};

export type UploadDeps = { familyId: string | null; supabase: UploadSupabase };

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const GENERIC = "Không thực hiện được. Vui lòng thử lại hoặc liên hệ quản trị viên.";

/** Đọc thân yêu cầu có giới hạn cứng (không tin Content-Length). null = vượt giới hạn / không có thân. */
export async function readLimited(req: Request, max: number): Promise<Buffer | null> {
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await reader.cancel().catch(() => {}); return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function handleUpload(req: Request, deps: UploadDeps): Promise<Response> {
  const { familyId, supabase } = deps;
  if (!familyId) return json({ error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." }, 401);

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_REQUEST_BYTES) return json({ error: REJECT_MESSAGES.too_large }, 413);
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) return json({ error: "Yêu cầu không hợp lệ." }, 400);

  const raw = await readLimited(req, MAX_REQUEST_BYTES);
  if (!raw) return json({ error: REJECT_MESSAGES.too_large }, 413);
  let form: FormData;
  try {
    form = await new Request("http://localhost/upload", {
      method: "POST", headers: { "content-type": contentType }, body: new Uint8Array(raw),
    }).formData();
  } catch {
    return json({ error: "Yêu cầu không hợp lệ." }, 400);
  }

  const fields = uploadFieldsSchema.safeParse({
    kind: form.get("kind"), memberId: form.get("memberId") ?? "", albumId: form.get("albumId") ?? "",
    caption: form.get("caption") ?? "", takenOn: form.get("takenOn") ?? "",
  });
  if (!fields.success) return json({ error: fields.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." }, 400);
  const { kind, memberId, albumId, caption, takenOn } = fields.data;
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Chưa chọn ảnh." }, 400);

  // ---- Xử lý ảnh: vẽ lại, bỏ EXIF/GPS. Không đảm bảo được thì TỪ CHỐI. ----
  let main: ProcessedImage;
  let thumb: ProcessedImage | null = null;
  try {
    main = await processMain(Buffer.from(await file.arrayBuffer()), kind as MediaKind);
    if (kind !== "avatar") {
      const fmt = main.mime === "image/jpeg" ? "jpeg" : "webp";
      const clientThumb = form.get("thumb");
      if (clientThumb instanceof File && clientThumb.size > 0) {
        try {
          thumb = await processThumb(Buffer.from(await clientThumb.arrayBuffer()), fmt);
        } catch (e) {
          if (e instanceof ImageRejected && e.code === "no_processor") throw e;
          thumb = null; // ảnh thu nhỏ từ trình duyệt hỏng: tự tạo lại từ ảnh chính
        }
      }
      thumb ??= await processThumb(main.buffer, fmt);
    }
  } catch (e) {
    if (e instanceof ImageRejected) return json({ error: e.message, code: e.code }, e.code === "no_processor" ? 503 : 422);
    return json({ error: "Không xử lý được ảnh. Vui lòng thử ảnh khác." }, 422);
  }

  // ---- CSDL cấp đường dẫn (kiểm quyền + hạn mức), ghi Storage bằng quyền người dùng, rồi chốt ----
  const { data: begin, error: beginError } = await supabase.rpc("begin_media_upload", {
    p_family: familyId, p_kind: kind, p_member: memberId, p_mime: main.mime, p_bytes: main.bytes,
    p_thumb_bytes: thumb?.bytes ?? 0, p_width: main.width, p_height: main.height,
  });
  if (beginError || !begin) {
    const status = beginError?.code === "42501" ? 403 : beginError?.code === "P0001" ? 409 : 400;
    return json({ error: mediaErrorMessage(beginError) ?? GENERIC }, status);
  }
  const ticket = begin as { id: string; bucket: string; path: string; thumb_path: string | null };

  const abort = async (message: string, status = 502) => {
    await supabase.rpc("cancel_media_upload", { p_media: ticket.id });
    return json({ error: message }, status);
  };

  const storage = supabase.storage.from(ticket.bucket);
  const up = await storage.upload(ticket.path, main.buffer, { contentType: main.mime, cacheControl: "31536000", upsert: false });
  if (up.error) return abort("Không lưu được ảnh vào kho. Vui lòng thử lại.");
  if (thumb && ticket.thumb_path) {
    const upThumb = await storage.upload(ticket.thumb_path, thumb.buffer, { contentType: thumb.mime, cacheControl: "31536000", upsert: false });
    if (upThumb.error) return abort("Không lưu được ảnh thu nhỏ vào kho. Vui lòng thử lại.");
  }
  const { error: finError } = await supabase.rpc("finalize_media", { p_media: ticket.id, p_sha256: main.sha256 });
  if (finError) return abort(mediaErrorMessage(finError) ?? "Không hoàn tất được việc lưu ảnh. Vui lòng thử lại.");

  let itemId: string | null = null;
  if (kind === "album" && albumId) {
    const { data, error } = await supabase.rpc("add_album_item", {
      p_album: albumId, p_media: ticket.id, p_caption: caption, p_taken_on: takenOn,
    });
    if (error) {
      // Ảnh đã lưu nhưng chưa vào album: job dọn sẽ xóa sau 24 giờ nếu không được gắn
      return json({ error: mediaErrorMessage(error) ?? "Đã tải ảnh lên nhưng chưa thêm được vào album.", mediaId: ticket.id }, 409);
    }
    itemId = data as string;
  }
  return json({
    ok: true, mediaId: ticket.id, bucket: ticket.bucket, path: ticket.path, thumbPath: ticket.thumb_path,
    width: main.width, height: main.height, bytes: main.bytes, itemId,
  });
}
