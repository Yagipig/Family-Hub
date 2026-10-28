"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chatError } from "@/lib/chat";
import { groupSchema, idSchema } from "@/lib/chat-schemas";

const BASE = "/tin-nhan/moi";
const back = (kind: "ok" | "error", msg: string): never => redirect(`${BASE}?${kind}=${encodeURIComponent(msg)}`);

export async function startDirect(formData: FormData) {
  const session = await requireSession();
  const userId = idSchema.safeParse(formData.get("userId"));
  if (!userId.success) return back("error", "Hãy chọn một người để nhắn.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_direct", { p_family: session.familyId, p_other: userId.data });
  if (error || typeof data !== "string") return back("error", chatError(error) || "Không mở được cuộc trò chuyện.");
  revalidatePath("/tin-nhan");
  redirect(`/tin-nhan/${data}`);
}

export async function createGroup(formData: FormData) {
  const session = await requireSession();
  const parsed = groupSchema.safeParse({
    title: formData.get("title"),
    members: formData.getAll("members").map(String),
  });
  if (!parsed.success) return back("error", parsed.error.issues[0]?.message ?? "Thông tin nhóm chưa hợp lệ.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", {
    p_family: session.familyId, p_title: parsed.data.title, p_members: parsed.data.members,
  });
  if (error || typeof data !== "string") return back("error", chatError(error) || "Không tạo được nhóm.");
  revalidatePath("/tin-nhan");
  redirect(`/tin-nhan/${data}`);
}
