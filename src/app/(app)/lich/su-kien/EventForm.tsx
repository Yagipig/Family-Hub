"use client";
import { useActionState, useState } from "react";
import { Alert, Field, SelectField } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import type { FormState } from "@/lib/schemas";
import { EVENT_KIND_LABELS } from "@/lib/calendar-model";

export type EventFormValues = {
  title: string; kind: string; date: string; allDay: boolean; startTime: string; endDate: string; endTime: string;
  timezone: string; branchId: string; visibility: string; recurrence: string; lunarMonth: string; lunarDay: string;
  lunarLeap: boolean; location: string; description: string;
};

const areaClass = "mt-1 block w-full rounded-xl border border-ink-soft/40 bg-white px-4 py-2 text-base text-ink";

export function EventForm({
  action, defaults, branches, zones, eventId, submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: EventFormValues;
  branches: { id: string; name: string }[];
  zones: { value: string; label: string }[];
  eventId?: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [allDay, setAllDay] = useState(defaults.allDay);
  const [recurrence, setRecurrence] = useState(defaults.recurrence);
  const [visibility, setVisibility] = useState(defaults.visibility);

  return (
    <form action={formAction} className="space-y-5">
      {eventId && <input type="hidden" name="eventId" value={eventId} />}
      {state?.error && <Alert kind="error">{state.error}</Alert>}

      <Field label="Tên sự kiện" name="title" defaultValue={defaults.title} required maxLength={200} />
      <SelectField label="Loại sự kiện" name="kind" defaultValue={defaults.kind}>
        {Object.entries(EVENT_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </SelectField>

      <fieldset className="space-y-4 rounded-xl border border-champagne/60 p-4">
        <legend className="px-2 text-base font-bold">Thời gian</legend>
        <Field label="Ngày bắt đầu" name="date" type="date" defaultValue={defaults.date} required min="1901-01-01" max="2099-12-31" />
        <label className="flex min-h-12 items-center gap-3 text-base font-semibold">
          <input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-6 accent-wine" />
          Cả ngày (không có giờ cụ thể)
        </label>
        {!allDay && <Field label="Giờ bắt đầu" name="startTime" type="time" defaultValue={defaults.startTime} required />}
        <Field label="Ngày kết thúc (nếu kéo dài nhiều ngày)" name="endDate" type="date" defaultValue={defaults.endDate} />
        {!allDay && <Field label="Giờ kết thúc (không bắt buộc)" name="endTime" type="time" defaultValue={defaults.endTime} />}
        <SelectField label="Múi giờ nơi tổ chức" name="timezone" defaultValue={defaults.timezone}>
          {zones.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
        </SelectField>
        <p className="text-sm text-ink-soft">Mỗi người sẽ thấy giờ theo múi giờ của mình, kèm giờ tại nơi tổ chức.</p>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-champagne/60 p-4">
        <legend className="px-2 text-base font-bold">Lặp lại</legend>
        <SelectField label="Kiểu lặp" name="recurrence" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
          <option value="none">Không lặp</option>
          <option value="yearly_solar">Hằng năm theo dương lịch (cùng ngày/tháng dương)</option>
          <option value="yearly_lunar">Hằng năm theo âm lịch (ví dụ ngày giỗ)</option>
        </SelectField>
        {recurrence === "yearly_lunar" && (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">
              Để trống hai ô dưới thì lấy theo ngày âm lịch của ngày bắt đầu. Nếu một năm không có tháng nhuận đó, hệ thống dùng tháng thường cùng số;
              ngày 30 của tháng chỉ có 29 ngày sẽ lùi về ngày 29.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tháng âm (1–12)" name="lunarMonth" type="number" inputMode="numeric" min={1} max={12} defaultValue={defaults.lunarMonth} />
              <Field label="Ngày âm (1–30)" name="lunarDay" type="number" inputMode="numeric" min={1} max={30} defaultValue={defaults.lunarDay} />
            </div>
            <label className="flex min-h-12 items-center gap-3 text-base font-semibold">
              <input type="checkbox" name="lunarLeap" defaultChecked={defaults.lunarLeap} className="size-6 accent-wine" />
              Tháng nhuận
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-champagne/60 p-4">
        <legend className="px-2 text-base font-bold">Ai xem được</legend>
        <SelectField label="Nhánh" name="branchId" defaultValue={defaults.branchId}>
          <option value="">Toàn gia đình</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </SelectField>
        <SelectField label="Phạm vi xem" name="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="family">Cả gia đình</option>
          <option value="branch">Chỉ nhánh đã chọn (cần chọn nhánh ở trên)</option>
        </SelectField>
      </fieldset>

      <Field label="Địa điểm" name="location" defaultValue={defaults.location} maxLength={300} />
      <label className="block text-base font-semibold">
        Mô tả
        <textarea name="description" defaultValue={defaults.description} rows={4} maxLength={4000} className={areaClass} />
      </label>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
