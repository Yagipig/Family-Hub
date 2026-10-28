import { redirect } from "next/navigation";
import { getSession, safeNext } from "@/lib/auth";
import { MfaPanel } from "@/components/MfaPanel";

export const metadata = { title: "Xác thực hai lớp" };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!(await getSession())) redirect("/dang-nhap");
  const { next } = await searchParams;
  return <MfaPanel mode="challenge" next={safeNext(next)} />;
}
