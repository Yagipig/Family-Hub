import { redirect } from "next/navigation";

export const metadata = { title: "Cây gia phả" };

// Mo app la vao thang cay gia pha (nguoi dung chot 31/10/2026: cay gia pha thay cho trang chu cu).
export default function HomePage() {
  redirect("/gia-pha");
}
