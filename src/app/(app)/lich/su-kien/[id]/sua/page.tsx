import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, buttonGhostClass } from "@/components/ui";
import { eventToFormDefaults } from "@/lib/events";
import { loadBranches, loadEvent } from "@/lib/events-server";
import { EventForm } from "../../EventForm";
import { updateEventAction } from "../../actions";
import { zoneOptions } from "../../zones";

export const metadata = { title: "Sửa sự kiện" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const ev = /^[0-9a-f-]{36}$/i.test(id) ? await loadEvent(id) : null;
  if (!ev) notFound();
  const supabase = await createClient();
  const { data: canManage } = await supabase.rpc("can_manage_event", { p_event: ev.id });
  if (canManage !== true || ev.cancelled_at) {
    return (
      <>
        <h1 className="text-3xl font-bold text-wine">Sửa sự kiện</h1>
        <Alert kind="error">{ev.cancelled_at ? "Sự kiện đã huỷ nên không sửa được." : "Bạn không có quyền sửa sự kiện này."}</Alert>
        <Link href={`/lich/su-kien/${ev.id}`} className={buttonGhostClass}>Quay lại sự kiện</Link>
      </>
    );
  }
  const defaults = eventToFormDefaults(ev);
  const branches = await loadBranches(session.familyId);
  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Sửa sự kiện</h1>
      <p className="text-base text-ink-soft">Giờ trong biểu mẫu là giờ tại múi giờ gốc của sự kiện ({defaults.timezone}).</p>
      <Card>
        <EventForm action={updateEventAction} eventId={ev.id} submitLabel="Lưu thay đổi" branches={branches}
          zones={zoneOptions(defaults.timezone)} defaults={defaults} />
      </Card>
      <Link href={`/lich/su-kien/${ev.id}`} className={buttonGhostClass}>Không sửa nữa</Link>
    </>
  );
}
