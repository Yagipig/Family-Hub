import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, buttonGhostClass } from "@/components/ui";
import { getViewer, loadBranches } from "@/lib/events-server";
import { localDateKey } from "@/lib/tz";
import { EventForm } from "../EventForm";
import { createEventAction } from "../actions";
import { zoneOptions } from "../zones";

export const metadata = { title: "Thêm sự kiện" };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ ngay?: string }> }) {
  const session = await requireSession();
  const viewer = await getViewer(session);
  const sp = await searchParams;
  const supabase = await createClient();
  const [fam, br] = await Promise.all([
    supabase.rpc("can_create_event", { p_family: session.familyId, p_branch: null }),
    session.branchId ? supabase.rpc("can_create_event", { p_family: session.familyId, p_branch: session.branchId }) : Promise.resolve({ data: false }),
  ]);
  if (fam.data !== true && br.data !== true) {
    return (
      <>
        <h1 className="text-3xl font-bold text-wine">Thêm sự kiện</h1>
        <Alert kind="error">
          Hiện bạn chưa thể thêm sự kiện. Thành viên chỉ thêm được khi quản trị viên mở chế độ chỉnh sửa; khách chỉ xem.
        </Alert>
        <Link href="/lich" className={buttonGhostClass}>Quay lại lịch</Link>
      </>
    );
  }
  const branches = await loadBranches(session.familyId);
  const date = sp.ngay && /^\d{4}-\d{2}-\d{2}$/.test(sp.ngay) ? sp.ngay : localDateKey(new Date(), viewer.viewerTz);
  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Thêm sự kiện</h1>
      <Card>
        <EventForm
          action={createEventAction}
          submitLabel="Tạo sự kiện"
          branches={branches}
          zones={zoneOptions(viewer.viewerTz)}
          defaults={{
            title: "", kind: "gathering", date, allDay: false, startTime: "19:00", endDate: "", endTime: "",
            timezone: viewer.viewerTz, branchId: "", visibility: "family", recurrence: "none", lunarMonth: "", lunarDay: "",
            lunarLeap: false, location: "", description: "",
          }}
        />
      </Card>
      <Link href="/lich" className={buttonGhostClass}>Quay lại lịch</Link>
    </>
  );
}
