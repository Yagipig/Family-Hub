import { requireSession } from "@/lib/auth";
import { Alert } from "@/components/ui";
import { MfaPanel } from "@/components/MfaPanel";

export const metadata = { title: "Xác thực hai lớp" };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  await requireSession();
  const { required } = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-3xl font-bold text-wine">Xác thực hai lớp</h1>
      {required && <Alert kind="error">Bạn cần bật xác thực hai lớp trước khi vào khu vực quản trị.</Alert>}
      <MfaPanel mode="enroll" next={required ? "/admin" : "/cai-dat"} />
    </div>
  );
}
