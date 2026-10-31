"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, type Session } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { memberError } from "@/lib/members-errors";
import { loadFieldAccess, loadMember } from "@/lib/members-data";
import {
  addParentSchema, addPartnerSchema, createPayload, diffMember, EDITABLE_KEYS, idSchema, noteSchema, parseMemberForm,
  relTargetSchema, updatePartnerSchema,
} from "@/lib/members-schemas";
import type { FormState } from "@/lib/schemas";

// Mỗi hàm xuất ra là MỘT hành động nhỏ. Quyền thật do RPC/RLS quyết định; ở đây chỉ kiểm tra đầu vào và dịch lỗi.

const fail = (error: string): FormState => ({ error });
const go = (path: string, kind: "ok" | "error", msg: string): never => redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);
const profile = (id: string) => `/thanh-vien/${id}`;

function notGuest(session: Session): string | null {
  return session.role === "guest" ? "Tài khoản khách chỉ được xem, không thể gửi thay đổi." : null;
}

async function submitRequest(
  session: Session, kind: string, target: string | null, payload: Record<string, unknown>, note: unknown,
): Promise<string | null> {
  const guest = notGuest(session);
  if (guest) return guest;
  const n = noteSchema.safeParse(typeof note === "string" ? note : "");
  if (!n.success) return n.error.issues[0]?.message ?? "Ghi chú chưa hợp lệ.";
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_change_request", {
    p_family: session.familyId, p_kind: kind, p_target: target, p_payload: payload, p_note: n.data,
  });
  return error ? memberError(error) : null;
}

// ---------- Hồ sơ thành viên (biểu mẫu dùng useActionState) ----------

export async function createMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const guest = notGuest(session);
  if (guest) return fail(guest);
  const parsed = parseMemberForm(formData);
  if (!parsed.ok) return fail(parsed.error);
  if (!parsed.data.full_name) return fail("Vui lòng nhập họ tên");
  const rel = relTargetSchema.safeParse({ rel: formData.get("rel") ?? "", relTo: formData.get("relTo") ?? "" });

  const supabase = await createClient();
  // "Thêm anh/chị/em": người mới là con của cha/mẹ ĐÃ GHI của người hiện tại.
  // Chưa có cha/mẹ nào trên cây thì KHÔNG tạo hồ sơ rời — thêm là phải có quan hệ ngay.
  let siblingParents: string[] = [];
  if (rel.success && rel.data.rel === "sibling" && rel.data.relTo) {
    const { data: plinks } = await supabase.from("member_parent_links_v").select("parent_id").eq("child_id", rel.data.relTo);
    siblingParents = [...new Set((plinks ?? []).map((r) => (r as { parent_id: string }).parent_id))];
    if (siblingParents.length === 0) {
      return fail("Người này chưa có cha/mẹ nào trên cây nên chưa thêm được anh/chị/em. Hãy thêm cha hoặc mẹ cho họ trước.");
    }
  }
  const { data, error } = await supabase.rpc("create_member", { p_family: session.familyId, p_data: createPayload(parsed.data) });
  if (error) return fail(memberError(error));
  const newId = z.uuid().safeParse(data);
  if (!newId.success) return fail("Không tạo được hồ sơ. Vui lòng thử lại.");

  // Tùy chọn: nối ngay quan hệ với người đã bấm “Thêm con / cha mẹ / vợ chồng” (RPC vẫn kiểm tra quyền)
  let warn = "";
  if (rel.success && rel.data.rel && rel.data.relTo) {
    const other = rel.data.relTo;
    if (rel.data.rel === "sibling") {
      for (const pid of siblingParents) {
        const rr = await supabase.rpc("add_parent_link", { p_child: newId.data, p_parent: pid, p_kind: "biological" });
        if (rr.error) { warn = `Đã tạo hồ sơ nhưng chưa nối được quan hệ: ${memberError(rr.error)}`; break; }
      }
    } else {
      const r = rel.data.rel === "child"
        ? await supabase.rpc("add_parent_link", { p_child: newId.data, p_parent: other, p_kind: "biological" })
        : rel.data.rel === "parent"
          ? await supabase.rpc("add_parent_link", { p_child: other, p_parent: newId.data, p_kind: "biological" })
          : await supabase.rpc("add_partnership", { p_x: newId.data, p_y: other, p_status: "married" });
      if (r.error) warn = `Đã tạo hồ sơ nhưng chưa nối được quan hệ: ${memberError(r.error)}`;
    }
  }
  revalidatePath("/thanh-vien");
  revalidatePath("/gia-pha");
  const base = `${profile(newId.data)}?ok=${encodeURIComponent("Đã thêm thành viên.")}`;
  if (warn) return redirect(`${base}&error=${encodeURIComponent(warn)}`);
  // Thêm từ cây (có quan hệ): quay lại sơ đồ, căn giữa người mới để thấy ngay đường nối vừa tạo.
  if (rel.success && rel.data.rel && rel.data.relTo) {
    return redirect(`/gia-pha?focus=${newId.data}&ok=${encodeURIComponent("Đã thêm thành viên và nối quan hệ trên cây.")}`);
  }
  return redirect(base);
}

export async function requestCreateMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = parseMemberForm(formData);
  if (!parsed.ok) return fail(parsed.error);
  if (!parsed.data.full_name) return fail("Vui lòng nhập họ tên");
  const err = await submitRequest(session, "create_member", null, createPayload(parsed.data), formData.get("note"));
  if (err) return fail(err);
  return go("/thanh-vien/yeu-cau", "ok", "Đã gửi yêu cầu thêm thành viên. Quản trị viên sẽ xem và duyệt.");
}

/** Tải hồ sơ gốc + quyền xem nhóm trường, tính phần thay đổi (không đụng tới nhóm bị che). */
async function prepareUpdate(formData: FormData) {
  const id = idSchema.safeParse(formData.get("memberId"));
  if (!id.success) return { error: "Hồ sơ không hợp lệ." } as const;
  const parsed = parseMemberForm(formData);
  if (!parsed.ok) return { error: parsed.error } as const;
  const supabase = await createClient();
  const [original, access] = await Promise.all([loadMember(supabase, id.data), loadFieldAccess(supabase, id.data)]);
  if (!original) return { error: "Không tìm thấy hồ sơ (có thể đã bị xóa)." } as const;
  const diff = diffMember(original, parsed.data, access);
  for (const k of Object.keys(diff)) if (!EDITABLE_KEYS.includes(k)) delete diff[k];
  if (Object.keys(diff).length === 0) return { error: "Bạn chưa thay đổi thông tin nào." } as const;
  return { id: id.data, diff } as const;
}

export async function updateMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const prep = await prepareUpdate(formData);
  if ("error" in prep) return fail(prep.error as string);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member", { p_member: prep.id, p_data: prep.diff });
  if (error) return fail(memberError(error));
  revalidatePath("/thanh-vien");
  revalidatePath("/gia-pha");
  return go(profile(prep.id), "ok", "Đã lưu thay đổi.");
}

export async function requestUpdateMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const prep = await prepareUpdate(formData);
  if ("error" in prep) return fail(prep.error as string);
  const err = await submitRequest(session, "update_member", prep.id, prep.diff, formData.get("note"));
  if (err) return fail(err);
  return go("/thanh-vien/yeu-cau", "ok", "Đã gửi yêu cầu chỉnh sửa. Quản trị viên sẽ xem và duyệt.");
}

// ---------- Xóa / khôi phục hồ sơ ----------

export async function deleteMemberAction(formData: FormData) {
  await requireSession();
  const id = idSchema.safeParse(formData.get("memberId"));
  if (!id.success) return go("/thanh-vien", "error", "Hồ sơ không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_member", { p_member: id.data });
  if (error) return go(profile(id.data), "error", memberError(error));
  revalidatePath("/thanh-vien");
  revalidatePath("/gia-pha");
  return go("/thanh-vien", "ok", "Đã chuyển hồ sơ vào thùng rác. Có thể khôi phục lại ở mục Thùng rác.");
}

export async function requestDeleteMemberAction(formData: FormData) {
  const session = await requireSession();
  const id = idSchema.safeParse(formData.get("memberId"));
  if (!id.success) return go("/thanh-vien", "error", "Hồ sơ không hợp lệ.");
  const err = await submitRequest(session, "delete_member", id.data, {}, formData.get("note"));
  if (err) return go(profile(id.data), "error", err);
  return go("/thanh-vien/yeu-cau", "ok", "Đã gửi yêu cầu xóa hồ sơ. Quản trị viên sẽ xem và duyệt.");
}

export async function restoreMemberAction(formData: FormData) {
  await requireSession();
  const id = idSchema.safeParse(formData.get("memberId"));
  if (!id.success) return go("/thanh-vien/thung-rac", "error", "Hồ sơ không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_member", { p_member: id.data });
  if (error) return go("/thanh-vien/thung-rac", "error", memberError(error));
  revalidatePath("/thanh-vien");
  revalidatePath("/gia-pha");
  return go("/thanh-vien/thung-rac", "ok", "Đã khôi phục hồ sơ.");
}

// ---------- Quan hệ cha mẹ - con ----------

async function addParentCore(formData: FormData, role: "parent" | "child", mode: "direct" | "request") {
  const session = await requireSession();
  const self = idSchema.safeParse(formData.get("memberId"));
  if (!self.success) return go("/thanh-vien", "error", "Hồ sơ không hợp lệ.");
  const picked = String(formData.get("otherId") ?? "");
  const parsed = addParentSchema.safeParse({
    childId: role === "parent" ? self.data : picked,
    parentId: role === "parent" ? picked : self.data,
    kind: formData.get("kind"),
  });
  if (!parsed.success) return go(profile(self.data), "error", parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
  const { childId, parentId, kind } = parsed.data;
  if (mode === "direct") {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_parent_link", { p_child: childId, p_parent: parentId, p_kind: kind });
    if (error) return go(profile(self.data), "error", memberError(error));
    revalidatePath(profile(self.data));
    revalidatePath("/gia-pha");
    return go(profile(self.data), "ok", "Đã thêm quan hệ.");
  }
  const err = await submitRequest(session, "add_parent", childId, { child_id: childId, parent_id: parentId, kind }, formData.get("note"));
  if (err) return go(profile(self.data), "error", err);
  return go("/thanh-vien/yeu-cau", "ok", "Đã gửi yêu cầu thêm quan hệ. Quản trị viên sẽ xem và duyệt.");
}
export async function addParentAction(formData: FormData) { return addParentCore(formData, "parent", "direct"); }
export async function addChildAction(formData: FormData) { return addParentCore(formData, "child", "direct"); }
export async function requestAddParentAction(formData: FormData) { return addParentCore(formData, "parent", "request"); }
export async function requestAddChildAction(formData: FormData) { return addParentCore(formData, "child", "request"); }

export async function removeParentLinkAction(formData: FormData) {
  await requireSession();
  const self = idSchema.safeParse(formData.get("memberId"));
  const link = idSchema.safeParse(formData.get("linkId"));
  if (!self.success || !link.success) return go("/thanh-vien", "error", "Yêu cầu không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_parent_link", { p_link: link.data });
  if (error) return go(profile(self.data), "error", memberError(error));
  revalidatePath(profile(self.data));
  revalidatePath("/gia-pha");
  return go(profile(self.data), "ok", "Đã gỡ quan hệ.");
}

export async function requestRemoveParentLinkAction(formData: FormData) {
  const session = await requireSession();
  const self = idSchema.safeParse(formData.get("memberId"));
  const link = idSchema.safeParse(formData.get("linkId"));
  if (!self.success || !link.success) return go("/thanh-vien", "error", "Yêu cầu không hợp lệ.");
  const err = await submitRequest(session, "remove_link", null, { link_id: link.data }, formData.get("note"));
  if (err) return go(profile(self.data), "error", err);
  return go("/thanh-vien/yeu-cau", "ok", "Đã gửi yêu cầu gỡ quan hệ. Quản trị viên sẽ xem và duyệt.");
}

// ---------- Quan hệ vợ chồng ----------

async function addPartnerCore(formData: FormData, mode: "direct" | "request") {
  const session = await requireSession();
  const self = idSchema.safeParse(formData.get("memberId"));
  if (!self.success) return go("/thanh-vien", "error", "Hồ sơ không hợp lệ.");
  const parsed = addPartnerSchema.safeParse({
    aId: self.data, bId: String(formData.get("otherId") ?? ""), status: formData.get("status"),
    startYear: String(formData.get("startYear") ?? ""), endYear: String(formData.get("endYear") ?? ""),
  });
  if (!parsed.success) return go(profile(self.data), "error", parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
  const { aId, bId, status, startYear, endYear } = parsed.data;
  if (mode === "direct") {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_partnership", {
      p_x: aId, p_y: bId, p_status: status, p_start: startYear, p_end: endYear,
    });
    if (error) return go(profile(self.data), "error", memberError(error));
    revalidatePath(profile(self.data));
    revalidatePath("/gia-pha");
    return go(profile(self.data), "ok", "Đã thêm quan hệ vợ chồng.");
  }
  const err = await submitRequest(session, "add_partner", aId,
    { a_id: aId, b_id: bId, status, start_year: startYear, end_year: endYear }, formData.get("note"));
  if (err) return go(profile(self.data), "error", err);
  return go("/thanh-vien/yeu-cau", "ok", "Đã gửi yêu cầu thêm vợ/chồng. Quản trị viên sẽ xem và duyệt.");
}
export async function addPartnerAction(formData: FormData) { return addPartnerCore(formData, "direct"); }
export async function requestAddPartnerAction(formData: FormData) { return addPartnerCore(formData, "request"); }

export async function updatePartnershipAction(formData: FormData) {
  await requireSession();
  const self = idSchema.safeParse(formData.get("memberId"));
  if (!self.success) return go("/thanh-vien", "error", "Hồ sơ không hợp lệ.");
  const parsed = updatePartnerSchema.safeParse({
    id: formData.get("partnershipId"), status: formData.get("status"),
    startYear: String(formData.get("startYear") ?? ""), endYear: String(formData.get("endYear") ?? ""),
  });
  if (!parsed.success) return go(profile(self.data), "error", parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_partnership", {
    p_id: parsed.data.id, p_status: parsed.data.status, p_start: parsed.data.startYear, p_end: parsed.data.endYear,
  });
  if (error) return go(profile(self.data), "error", memberError(error));
  revalidatePath(profile(self.data));
  revalidatePath("/gia-pha");
  return go(profile(self.data), "ok", "Đã cập nhật tình trạng hôn nhân.");
}

export async function removePartnershipAction(formData: FormData) {
  await requireSession();
  const self = idSchema.safeParse(formData.get("memberId"));
  const pid = idSchema.safeParse(formData.get("partnershipId"));
  if (!self.success || !pid.success) return go("/thanh-vien", "error", "Yêu cầu không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_partnership", { p_id: pid.data });
  if (error) return go(profile(self.data), "error", memberError(error));
  revalidatePath(profile(self.data));
  revalidatePath("/gia-pha");
  return go(profile(self.data), "ok", "Đã gỡ quan hệ vợ chồng.");
}

export async function requestRemovePartnershipAction(formData: FormData) {
  const session = await requireSession();
  const self = idSchema.safeParse(formData.get("memberId"));
  const pid = idSchema.safeParse(formData.get("partnershipId"));
  if (!self.success || !pid.success) return go("/thanh-vien", "error", "Yêu cầu không hợp lệ.");
  const err = await submitRequest(session, "remove_link", null, { partnership_id: pid.data }, formData.get("note"));
  if (err) return go(profile(self.data), "error", err);
  return go("/thanh-vien/yeu-cau", "ok", "Đã gửi yêu cầu gỡ quan hệ. Quản trị viên sẽ xem và duyệt.");
}
