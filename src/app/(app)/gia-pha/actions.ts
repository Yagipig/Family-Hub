"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.uuid();

/**
 * Admin sắp xếp cây: dời một người lên trước / xuống sau trong nhóm anh chị em
 * (cùng cha mẹ; nhóm gốc = các thành viên không có cha mẹ). RPC sibling_move
 * kiểm tra quyền members/update và chuẩn hoá lại thứ tự cả nhóm.
 */
export async function moveSiblingAction(formData: FormData) {
  await requireSession();
  const id = idSchema.safeParse(formData.get("memberId"));
  const dir = formData.get("dir") === "-1" ? -1 : formData.get("dir") === "1" ? 1 : null;
  if (!id.success || dir === null) {
    return redirect("/gia-pha?error=" + encodeURIComponent("Yêu cầu không hợp lệ."));
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("sibling_move", { p_member: id.data, p_dir: dir });
  if (error) {
    const msg = error.message.includes("already at edge")
      ? dir === -1 ? "Người này đã đứng đầu nhóm anh chị em rồi." : "Người này đã đứng cuối nhóm anh chị em rồi."
      : error.message.includes("forbidden") || error.code === "42501"
        ? "Chỉ quản trị viên mới sắp xếp được thứ tự trên cây gia phả."
        : "Không dời được vị trí. Vui lòng thử lại.";
    return redirect(`/gia-pha?focus=${id.data}&error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/gia-pha");
  revalidatePath("/thanh-vien");
  return redirect(`/gia-pha?focus=${id.data}&ok=${encodeURIComponent("Đã sắp xếp lại thứ tự anh chị em.")}`);
}
