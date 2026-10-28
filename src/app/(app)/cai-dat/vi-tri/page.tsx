import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { Card, buttonGhostClass } from "@/components/ui";
import { getViewer } from "@/lib/events-server";
import { formatOffset } from "@/lib/tz";
import { LocationForm } from "./LocationForm";

export const metadata = { title: "Quốc gia và múi giờ" };

export default async function LocationPage() {
  const session = await requireSession();
  const viewer = await getViewer(session);
  return (
    <>
      <h1 className="text-3xl font-bold text-wine">Quốc gia và múi giờ</h1>
      <Card className="space-y-4">
        <p className="text-base text-ink-soft">
          Giờ của sự kiện trên lịch và thời điểm gửi thông báo &ldquo;hôm nay&rdquo; sẽ theo múi giờ này.
          Hiện tại: <strong>{viewer.viewerTz.replace(/_/g, " ")}</strong> ({formatOffset(new Date(), viewer.viewerTz)}).
          Các thành viên khác trong gia đình có thể thấy quốc gia và múi giờ bạn chọn (để hiện giờ ở nơi người thân sống).
        </p>
        <LocationForm country={viewer.countryCode ?? ""} timezone={viewer.viewerTz} />
      </Card>
      <Link href="/cai-dat" className={buttonGhostClass}>Quay lại cài đặt</Link>
    </>
  );
}
