"use server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redeemSchema, type FormState } from "@/lib/schemas";

const INVALID = "Lời mời không hợp lệ, đã hết hạn hoặc đã được dùng. Hãy nhờ quản trị viên gửi lời mời mới.";

export async function redeem(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = redeemSchema.safeParse({
    token: formData.get("token"),
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  const { token, displayName, email, password } = parsed.data;

  const admin = createAdminClient();
  const { data: peek } = await admin.rpc("peek_invitation", { p_token: token });
  const invite = peek?.[0];
  if (!invite) return { error: INVALID };
  if (invite.email && invite.email !== email) return { error: "Email không khớp với email được mời." };

  // Lời mời do quản trị viên gửi riêng cho người nhận; token là bằng chứng được phép tạo tài khoản.
  // (Xem docs/DOT-1.md: xác thực hộp thư sẽ bổ sung khi có dịch vụ gửi email.)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (createError || !created.user) {
    return { error: "Không tạo được tài khoản. Nếu email này đã có tài khoản, hãy liên hệ quản trị viên." };
  }

  const { error: redeemError } = await admin.rpc("redeem_invitation", {
    p_token: token,
    p_user_id: created.user.id,
    p_display_name: displayName,
  });
  if (redeemError) {
    await admin.auth.admin.deleteUser(created.user.id); // không để lại tài khoản mồ côi
    return { error: INVALID };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) redirect("/dang-nhap");
  redirect("/");
}
