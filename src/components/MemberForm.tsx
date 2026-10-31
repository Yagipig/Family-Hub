"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Alert, Card, Field, SelectField, buttonClass, buttonGhostClass } from "@/components/ui";
import type { FormState } from "@/lib/schemas";
import { emptyValues, type FormValues } from "@/lib/members-form";
import { BIRTHDAY_MODE_LABELS, GENDER_LABELS, VISIBILITY_LABELS } from "@/lib/members-text";
import type { BranchRow, FieldAccess } from "@/lib/members-types";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

type Props = {
  /** create: thêm mới; update: sửa hồ sơ có sẵn */
  mode: "create" | "update";
  memberId?: string;
  initial?: FormValues;
  branches: BranchRow[];
  /** Nhóm trường được xem/sửa (nhóm bị che bị tắt, không bao giờ gửi đi) */
  access: FieldAccess;
  /** update: được lưu trực tiếp? */
  directAllowed?: boolean;
  /** create: các nhánh được tạo trực tiếp ("" = chưa xếp nhánh) */
  directBranches?: string[];
  /** Chỉ quản trị mới đổi nhánh trực tiếp được; khi gửi yêu cầu thì ai cũng đề xuất được */
  isAdmin: boolean;
  /** Hiện 4 mức hiển thị (ẩn khi chỉ gửi yêu cầu sửa hồ sơ có sẵn) */
  showVisibility: boolean;
  rel?: { rel: string; relTo: string; relToName: string };
  directAction: Action;
  requestAction: Action;
  cancelHref: string;
};

const textareaClass = "mt-1 block w-full rounded-xl border border-ink-soft/40 bg-white px-4 py-3 text-base text-ink";

function Group({ legend, children, hint }: { legend: string; children: React.ReactNode; hint?: string }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-xl font-bold text-wine">{legend}</legend>
      {hint && <p className="text-base text-ink-soft">{hint}</p>}
      {children}
    </fieldset>
  );
}
const Masked = ({ what }: { what: string }) => (
  <p className="rounded-xl border border-champagne bg-champagne-soft px-4 py-3 text-base text-ink-soft">
    Bạn không có quyền xem {what} của người này nên không thể sửa mục này.
  </p>
);

export function MemberForm(p: Props) {
  const [v, setV] = useState<FormValues>(p.initial ?? emptyValues());
  const [dState, dAction, dPending] = useActionState(p.directAction, null);
  const [rState, rAction, rPending] = useActionState(p.requestAction, null);
  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((o) => ({ ...o, [k]: val }));
  const bind = (k: keyof FormValues) => ({
    name: k as string, value: v[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
  });
  const bindCheck = (k: "birth_lunar_leap" | "is_deceased" | "death_lunar_leap") => ({
    name: k as string, checked: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.checked),
  });

  const direct = p.mode === "update" ? !!p.directAllowed : (p.directBranches ?? []).includes(v.branch_id);
  const pending = dPending || rPending;
  const error = direct ? dState?.error : rState?.error;
  const groups = ["basic", "other", ...(p.access.birth ? ["birth"] : []), ...(p.access.death ? ["death"] : []),
    ...(p.access.contact ? ["contact"] : []), ...(p.showVisibility ? ["visibility"] : [])].join(",");
  const canChangeBranch = p.mode === "create" || !direct || p.isAdmin;
  const num = (k: keyof FormValues, label: string, extra: { hint?: string } = {}) => (
    <Field label={label} inputMode="numeric" autoComplete="off" maxLength={4} {...bind(k)} {...extra} />
  );

  return (
    <form action={direct ? dAction : rAction} className="space-y-6" noValidate>
      <input type="hidden" name="groups" value={groups} />
      {p.memberId && <input type="hidden" name="memberId" value={p.memberId} />}
      {p.rel && <><input type="hidden" name="rel" value={p.rel.rel} /><input type="hidden" name="relTo" value={p.rel.relTo} /></>}

      {error && <Alert kind="error">{error}</Alert>}
      {!direct && (
        <Alert kind="ok">
          Chế độ chỉnh sửa đang khóa với bạn. Thông tin bạn nhập sẽ được <strong>gửi cho quản trị viên duyệt</strong>, chưa thay đổi ngay.
        </Alert>
      )}
      {p.rel && p.mode === "create" && direct && (
        <p className="text-base text-ink-soft">
          Hồ sơ mới sẽ được nối với <strong>{p.rel.relToName}</strong> ({p.rel.rel === "child" ? "là con" : p.rel.rel === "parent" ? "là cha/mẹ" : p.rel.rel === "sibling" ? "là anh/chị/em (cùng cha mẹ)" : "là vợ/chồng"}).
        </p>
      )}
      {p.rel && !direct && (
        <p className="text-base text-ink-soft">Yêu cầu thêm hồ sơ không tự nối quan hệ; sau khi được duyệt hãy thêm quan hệ với {p.rel.relToName}.</p>
      )}

      <Card className="space-y-6">
        <Group legend="Thông tin chung">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ và tên *" required maxLength={160} autoComplete="off" {...bind("full_name")} />
            <Field label="Tên thường gọi" maxLength={80} autoComplete="off" {...bind("nickname")} />
            <Field label="Tên gọi khác (tên húy, tên khai sinh...)" maxLength={160} autoComplete="off" {...bind("alt_names")} />
            <SelectField label="Giới tính" {...bind("gender")}>
              <option value="">— Chưa rõ —</option>
              {Object.entries(GENDER_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </SelectField>
            {canChangeBranch ? (
              <SelectField label="Nhánh họ" {...bind("branch_id")}>
                <option value="">— Chưa xếp nhánh —</option>
                {p.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SelectField>
            ) : (
              <SelectField label="Nhánh họ (chỉ quản trị viên được đổi)" value={v.branch_id} disabled onChange={() => {}}>
                <option value="">— Chưa xếp nhánh —</option>
                {p.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SelectField>
            )}
            <Field label="Quê quán" maxLength={200} autoComplete="off" {...bind("hometown")} />
            <Field label="Đời (số thứ tự, 1–60)" inputMode="numeric" maxLength={2} autoComplete="off" {...bind("generation_no")}
              hint="Có thể để trống; sơ đồ gia phả sẽ tự tính đời." />
            <Field label="Tên đời / bối (nếu dòng họ có)" maxLength={80} autoComplete="off" {...bind("generation_title")} />
          </div>
        </Group>
      </Card>

      <Card className="space-y-6">
        <Group legend="Ngày sinh" hint="Chỉ nhớ năm thì chỉ cần nhập năm. Ví dụ ngày 5 tháng 3 năm 1950: Ngày 5, Tháng 3, Năm 1950.">
          {p.access.birth ? (
            <>
              <fieldset>
                <legend className="text-lg font-semibold">Ngày sinh theo dương lịch</legend>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {num("birth_solar_day", "Ngày")}{num("birth_solar_month", "Tháng")}{num("birth_solar_year", "Năm")}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-lg font-semibold">Ngày sinh theo âm lịch</legend>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {num("birth_lunar_day", "Ngày")}{num("birth_lunar_month", "Tháng")}{num("birth_lunar_year", "Năm")}
                </div>
                <label className="mt-3 flex min-h-12 items-center gap-3 text-base font-semibold">
                  <input type="checkbox" className="size-6 accent-wine" {...bindCheck("birth_lunar_leap")} /> Tháng nhuận
                </label>
              </fieldset>
              <SelectField label="Nhắc sinh nhật theo" {...bind("birthday_mode")}>
                {Object.entries(BIRTHDAY_MODE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </SelectField>
            </>
          ) : <Masked what="ngày sinh" />}
        </Group>
      </Card>

      <Card className="space-y-6">
        <Group legend="Đã mất">
          {p.access.death ? (
            <>
              <label className="flex min-h-12 items-center gap-3 text-base font-semibold">
                <input type="checkbox" className="size-6 accent-wine" {...bindCheck("is_deceased")} /> Người này đã mất
              </label>
              {v.is_deceased && (
                <>
                  <fieldset>
                    <legend className="text-lg font-semibold">Ngày mất theo dương lịch</legend>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      {num("death_solar_day", "Ngày")}{num("death_solar_month", "Tháng")}{num("death_solar_year", "Năm")}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="text-lg font-semibold">Ngày mất theo âm lịch (dùng để nhắc ngày giỗ)</legend>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      {num("death_lunar_day", "Ngày")}{num("death_lunar_month", "Tháng")}
                    </div>
                    <label className="mt-3 flex min-h-12 items-center gap-3 text-base font-semibold">
                      <input type="checkbox" className="size-6 accent-wine" {...bindCheck("death_lunar_leap")} /> Tháng nhuận
                    </label>
                  </fieldset>
                </>
              )}
            </>
          ) : <Masked what="ngày mất" />}
        </Group>
      </Card>

      <Card className="space-y-6">
        <Group legend="Giới thiệu">
          <label className="block text-base font-semibold">
            Tiểu sử (tối đa 5000 ký tự)
            <textarea rows={6} maxLength={5000} className={textareaClass} {...bind("bio")} />
          </label>
        </Group>
      </Card>

      <Card className="space-y-6">
        <Group legend="Liên hệ">
          {p.access.contact ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Số điện thoại" type="tel" inputMode="tel" maxLength={40} autoComplete="off" {...bind("phone")} />
              <Field label="Email" type="email" inputMode="email" maxLength={254} autoComplete="off" {...bind("email")} />
            </div>
          ) : <Masked what="thông tin liên hệ" />}
        </Group>
      </Card>

      {p.showVisibility && (
        <Card className="space-y-6">
          <Group legend="Ai được xem?" hint="Trẻ em dưới 18 tuổi luôn được giới hạn tối đa trong nhánh, kể cả khi chọn “Cả gia đình”. Quản trị viên và chính chủ luôn xem được.">
            <div className="grid gap-4 sm:grid-cols-2">
              {([["birth_visibility", "Ngày sinh"], ["death_visibility", "Ngày mất"], ["contact_visibility", "Điện thoại và email"], ["photo_visibility", "Ảnh đại diện"]] as const).map(([k, l]) => (
                <SelectField key={k} label={l} {...bind(k)}>
                  {Object.entries(VISIBILITY_LABELS).map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                </SelectField>
              ))}
            </div>
          </Group>
        </Card>
      )}

      {!direct && (
        <Card>
          <label className="block text-base font-semibold">
            Ghi chú cho quản trị viên (không bắt buộc)
            <textarea name="note" rows={3} maxLength={1000} className={textareaClass} />
          </label>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Đang xử lý…" : direct ? "Lưu" : p.mode === "create" ? "Gửi yêu cầu thêm thành viên" : "Gửi yêu cầu chỉnh sửa"}
        </button>
        <Link href={p.cancelHref} className={buttonGhostClass}>Hủy</Link>
      </div>
    </form>
  );
}
