"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type FormState } from "@/lib/schemas";

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Vui lòng nhập email và mật khẩu hợp lệ." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Thông báo chung: không cho biết email có tồn tại hay không.
  if (error) return { error: "Email hoặc mật khẩu không đúng." };
  redirect("/");
}
