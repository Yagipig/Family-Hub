import Link from "next/link";
import { can, requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, buttonGhostClass } from "@/components/ui";
import { LotoGridView } from "@/components/LotoGridView";
import { BoardEditor } from "@/components/BoardEditor";

export const metadata = { title: "Sửa 63 bảng tỉnh lô tô" };

const REGION_LABEL: Record<string, string> = { bac: "Miền Bắc", trung: "Miền Trung", nam: "Miền Nam" };

type Board = { code: string; province_name: string; region: string; grid: number[]; updated_at: string };

export default async function LotoBoardsAdminPage({ searchParams }: {
  searchParams: Promise<{ ok?: string; error?: string; code?: string }>;
}) {
  const session = await requireAdmin("/admin/tro-choi/bang-lo-to");
  const { ok, error, code } = await searchParams;
  const allowed = await can(session, "games", "update");
  if (!allowed) {
    return (
      <>
        <h1 className="text-3xl font-bold text-wine">63 bảng tỉnh lô tô</h1>
        <Card><p className="text-lg">Chỉ Super Admin và Quản trị gia đình mới sửa được bảng tỉnh.</p></Card>
      </>
    );
  }
  const supabase = await createClient();
  const [{ data: bd }, { data: hd }] = await Promise.all([
    supabase.from("loto_boards").select("code, province_name, region, grid, updated_at").order("code"),
    supabase.from("loto_board_history").select("code"),
  ]);
  const boards = (bd ?? []) as Board[];
  const historyCount = new Map<string, number>();
  for (const h of (hd ?? []) as Array<{ code: string }>) historyCount.set(h.code, (historyCount.get(h.code) ?? 0) + 1);
  const selected = boards.find((b) => b.code === code) ?? null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-wine">63 bảng tỉnh lô tô truyền thống</h1>
        <Link href="/admin/tro-choi" className={buttonGhostClass}>← Quản trị trò chơi</Link>
      </div>
      <p className="text-base text-ink-soft">
        Mỗi tỉnh/thành cũ có một bảng cố định. Bấm vào một tỉnh để sửa: đảo bộ số mới hoặc xếp lại bố cục giữ nguyên số,
        xem trước rồi mới lưu. Mọi lần lưu đều ghi lịch sử để khôi phục. Thay đổi chỉ áp dụng cho các ván sau.
      </p>
      {ok && <Alert kind="ok">{ok}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      {selected && (
        <Card className="space-y-3">
          <BoardEditor
            code={selected.code}
            name={selected.province_name}
            savedGrid={selected.grid}
            historyCount={historyCount.get(selected.code) ?? 0}
          />
        </Card>
      )}

      {(["bac", "trung", "nam"] as const).map((region) => (
        <Card key={region} className="space-y-3">
          <h2 className="text-xl font-bold">{REGION_LABEL[region]}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boards.filter((b) => b.region === region).map((b) => (
              <Link
                key={b.code}
                href={`/admin/tro-choi/bang-lo-to?code=${b.code}`}
                className={`space-y-2 rounded-xl border p-3 hover:bg-champagne-soft ${selected?.code === b.code ? "border-wine bg-champagne-soft" : "border-champagne/60"}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <strong>{b.province_name}</strong>
                  <span className="text-sm text-ink-soft">{b.code}{(historyCount.get(b.code) ?? 0) > 0 ? ` · ${historyCount.get(b.code)} bản lịch sử` : ""}</span>
                </span>
                <LotoGridView grid={b.grid} compact />
              </Link>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}
