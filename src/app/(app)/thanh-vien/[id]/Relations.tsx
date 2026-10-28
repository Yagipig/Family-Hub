import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { MemberPicker } from "@/components/MemberPicker";
import { ConfirmButton } from "@/components/SubmitButton";
import { Card, Field, SelectField, buttonClass } from "@/components/ui";
import { lifeSpan, PARENT_KIND_LABELS, PARTNER_STATUS_LABELS } from "@/lib/members-text";
import type { ParentKind, PartnerStatus, PickerMember, TreePerson } from "@/lib/members-types";
import {
  addChildAction, addParentAction, addPartnerAction, removeParentLinkAction, removePartnershipAction,
  requestAddChildAction, requestAddParentAction, requestAddPartnerAction, requestRemoveParentLinkAction,
  requestRemovePartnershipAction, updatePartnershipAction,
} from "../actions";

export type RelMode = "direct" | "request" | "none";
type Person = TreePerson;

export type RelationsProps = {
  memberId: string;
  mode: RelMode;
  parents: { linkId: string; person: Person; kind: ParentKind }[];
  children: { linkId: string; person: Person; kind: ParentKind }[];
  partners: { id: string; person: Person; status: PartnerStatus; start: number | null; end: number | null }[];
  siblings: { person: Person; full: boolean }[];
  pickers: PickerMember[];
};

function Mini({ p, extra }: { p: Person; extra?: string }) {
  const span = lifeSpan(p.by, p.dy, p.dead);
  return (
    <Link href={`/thanh-vien/${p.id}`} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1 hover:bg-champagne-soft">
      <Avatar name={p.name} src={p.avatar} gender={p.gender} size={44} />
      <span className="min-w-0">
        <span className="block text-base font-semibold leading-snug">{p.name}{p.dead ? " (đã mất)" : ""}</span>
        <span className="block text-sm text-ink-soft">{[extra, span].filter(Boolean).join(" · ")}</span>
      </span>
    </Link>
  );
}

const removeBtn = "min-h-12 rounded-xl border border-danger px-4 text-base font-semibold text-danger hover:bg-red-50";

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] | null }) {
  const has = children && children.length > 0;
  return (
    <section className="space-y-2">
      <h3 className="text-lg font-bold">{title}</h3>
      {has ? <ul className="divide-y divide-champagne/40">{children}</ul> : <p className="text-base text-ink-soft">{empty}</p>}
    </section>
  );
}

export function Relations(p: RelationsProps) {
  const direct = p.mode === "direct";
  const editable = p.mode !== "none";
  const related = [p.memberId, ...p.parents.map((x) => x.person.id), ...p.children.map((x) => x.person.id), ...p.partners.map((x) => x.person.id)];
  const verb = direct ? "Thêm" : "Đề nghị thêm";
  const submit = direct ? "Thêm" : "Gửi yêu cầu";
  const noteField = !direct && (
    <Field label="Ghi chú cho quản trị viên (không bắt buộc)" name="note" maxLength={1000} autoComplete="off" />
  );

  return (
    <Card className="space-y-8">
      <h2 className="text-2xl font-bold text-wine">Quan hệ gia đình</h2>
      {!direct && editable && (
        <p className="rounded-xl border border-champagne bg-champagne-soft px-4 py-3 text-base">
          Chế độ chỉnh sửa đang khóa với bạn: các thay đổi quan hệ sẽ được <strong>gửi cho quản trị viên duyệt</strong>.
        </p>
      )}

      <Section title="Cha mẹ" empty="Chưa ghi nhận cha mẹ.">
        {p.parents.map((x) => (
          <li key={x.linkId} className="flex flex-wrap items-center gap-2 py-2">
            <Mini p={x.person} extra={`Cha/mẹ ${PARENT_KIND_LABELS[x.kind]}`} />
            {editable && (
              <form action={direct ? removeParentLinkAction : requestRemoveParentLinkAction}>
                <input type="hidden" name="memberId" value={p.memberId} /><input type="hidden" name="linkId" value={x.linkId} />
                <ConfirmButton className={removeBtn} message={direct ? `Gỡ quan hệ cha/mẹ với ${x.person.name}?` : `Gửi yêu cầu gỡ quan hệ với ${x.person.name}?`}>
                  {direct ? "Gỡ" : "Đề nghị gỡ"}
                </ConfirmButton>
              </form>
            )}
          </li>
        ))}
      </Section>

      <Section title="Vợ / chồng" empty="Chưa ghi nhận vợ/chồng.">
        {p.partners.map((x) => (
          <li key={x.id} className="space-y-2 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Mini p={x.person} extra={`${PARTNER_STATUS_LABELS[x.status]}${x.start ? ` từ ${x.start}` : ""}${x.end ? ` đến ${x.end}` : ""}`} />
              {editable && (
                <form action={direct ? removePartnershipAction : requestRemovePartnershipAction}>
                  <input type="hidden" name="memberId" value={p.memberId} /><input type="hidden" name="partnershipId" value={x.id} />
                  <ConfirmButton className={removeBtn} message={`Gỡ quan hệ vợ/chồng với ${x.person.name}?`}>{direct ? "Gỡ" : "Đề nghị gỡ"}</ConfirmButton>
                </form>
              )}
            </div>
            {direct && (
              <details className="rounded-xl border border-champagne/60 px-4 py-2">
                <summary className="min-h-12 cursor-pointer py-3 text-base font-semibold text-wine">Sửa tình trạng hôn nhân</summary>
                <form action={updatePartnershipAction} className="grid gap-4 pb-3 sm:grid-cols-3">
                  <input type="hidden" name="memberId" value={p.memberId} /><input type="hidden" name="partnershipId" value={x.id} />
                  <SelectField label="Tình trạng" name="status" defaultValue={x.status}>
                    {Object.entries(PARTNER_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </SelectField>
                  <Field label="Từ năm" name="startYear" inputMode="numeric" maxLength={4} defaultValue={x.start ?? ""} />
                  <Field label="Đến năm" name="endYear" inputMode="numeric" maxLength={4} defaultValue={x.end ?? ""} />
                  <div className="sm:col-span-3"><button className={buttonClass}>Lưu</button></div>
                </form>
              </details>
            )}
          </li>
        ))}
      </Section>

      <Section title="Con" empty="Chưa ghi nhận con.">
        {p.children.map((x) => (
          <li key={x.linkId} className="flex flex-wrap items-center gap-2 py-2">
            <Mini p={x.person} extra={x.kind === "biological" ? undefined : `Con ${PARENT_KIND_LABELS[x.kind]}`} />
            {editable && (
              <form action={direct ? removeParentLinkAction : requestRemoveParentLinkAction}>
                <input type="hidden" name="memberId" value={p.memberId} /><input type="hidden" name="linkId" value={x.linkId} />
                <ConfirmButton className={removeBtn} message={`Gỡ quan hệ cha/mẹ - con với ${x.person.name}?`}>{direct ? "Gỡ" : "Đề nghị gỡ"}</ConfirmButton>
              </form>
            )}
          </li>
        ))}
      </Section>

      <Section title="Anh chị em" empty="Chưa ghi nhận anh chị em (suy ra từ cha mẹ chung).">
        {p.siblings.map((x) => (
          <li key={x.person.id} className="py-2"><Mini p={x.person} extra={x.full ? "Cùng cha mẹ" : "Cùng cha hoặc cùng mẹ"} /></li>
        ))}
      </Section>

      {editable && (
        <section className="space-y-3 border-t border-champagne/60 pt-6">
          <h3 className="text-lg font-bold">{direct ? "Thêm quan hệ" : "Đề nghị thêm quan hệ"}</h3>

          <details className="rounded-xl border border-champagne/60 px-4">
            <summary className="min-h-12 cursor-pointer py-3 text-base font-semibold text-wine">{verb} cha / mẹ</summary>
            <form action={direct ? addParentAction : requestAddParentAction} className="space-y-4 pb-4">
              <input type="hidden" name="memberId" value={p.memberId} />
              <MemberPicker name="otherId" label="Chọn cha hoặc mẹ" members={p.pickers} excludeIds={related} />
              <SelectField label="Loại quan hệ" name="kind" defaultValue="biological">
                <option value="biological">Cha/mẹ ruột (tối đa 2 người)</option>
                <option value="adoptive">Cha/mẹ nuôi</option>
                <option value="step">Cha/mẹ kế</option>
              </SelectField>
              {noteField}
              <button className={buttonClass}>{submit}</button>
            </form>
          </details>

          <details className="rounded-xl border border-champagne/60 px-4">
            <summary className="min-h-12 cursor-pointer py-3 text-base font-semibold text-wine">{verb} vợ / chồng</summary>
            <form action={direct ? addPartnerAction : requestAddPartnerAction} className="space-y-4 pb-4">
              <input type="hidden" name="memberId" value={p.memberId} />
              <MemberPicker name="otherId" label="Chọn vợ hoặc chồng" members={p.pickers} excludeIds={related} />
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField label="Tình trạng" name="status" defaultValue="married">
                  {Object.entries(PARTNER_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </SelectField>
                <Field label="Từ năm (không bắt buộc)" name="startYear" inputMode="numeric" maxLength={4} />
                <Field label="Đến năm (không bắt buộc)" name="endYear" inputMode="numeric" maxLength={4} />
              </div>
              {noteField}
              <button className={buttonClass}>{submit}</button>
            </form>
          </details>

          <details className="rounded-xl border border-champagne/60 px-4">
            <summary className="min-h-12 cursor-pointer py-3 text-base font-semibold text-wine">{verb} con</summary>
            <form action={direct ? addChildAction : requestAddChildAction} className="space-y-4 pb-4">
              <input type="hidden" name="memberId" value={p.memberId} />
              <MemberPicker name="otherId" label="Chọn người con (đã có hồ sơ)" members={p.pickers} excludeIds={related} />
              <SelectField label="Loại quan hệ" name="kind" defaultValue="biological">
                <option value="biological">Con ruột</option>
                <option value="adoptive">Con nuôi</option>
                <option value="step">Con riêng của vợ/chồng (kế)</option>
              </SelectField>
              {noteField}
              <button className={buttonClass}>{submit}</button>
            </form>
            {direct && (
              <p className="pb-4 text-base text-ink-soft">
                Chưa có hồ sơ? <Link href={`/thanh-vien/moi?rel=child&to=${p.memberId}`} className="font-semibold text-wine underline">Tạo hồ sơ con mới</Link>
                {" · "}
                <Link href={`/thanh-vien/moi?rel=partner&to=${p.memberId}`} className="font-semibold text-wine underline">Tạo hồ sơ vợ/chồng mới</Link>
                {" · "}
                <Link href={`/thanh-vien/moi?rel=parent&to=${p.memberId}`} className="font-semibold text-wine underline">Tạo hồ sơ cha/mẹ mới</Link>
              </p>
            )}
          </details>
        </section>
      )}
    </Card>
  );
}
