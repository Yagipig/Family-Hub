"use client";
import { useActionState, useMemo, useState } from "react";
import { Alert, SelectField } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { COUNTRIES, allZones, findCountry } from "@/lib/countries";
import { saveLocation } from "./actions";

export function LocationForm({ country, timezone }: { country: string; timezone: string }) {
  const [state, action] = useActionState(saveLocation, null);
  const [cc, setCc] = useState(country);
  const [tz, setTz] = useState(timezone);
  const [showAll, setShowAll] = useState(false);
  const countryZones = findCountry(cc)?.zones ?? [];
  const zones = useMemo(() => {
    const base = showAll || countryZones.length === 0 ? allZones() : [...countryZones];
    return base.includes(tz) ? base : [tz, ...base];
  }, [showAll, countryZones, tz]);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="ok">{state.ok}</Alert>}
      <SelectField
        label="Quốc gia nơi bạn đang sống"
        name="country"
        value={cc}
        onChange={(e) => {
          const next = e.target.value;
          setCc(next);
          setShowAll(false);
          const c = findCountry(next);
          if (c) setTz(c.zones[0]);   // gợi ý múi giờ; người dùng vẫn đổi tay được
        }}
      >
        <option value="">Chưa chọn</option>
        {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </SelectField>
      <SelectField label="Múi giờ" name="timezone" value={tz} onChange={(e) => setTz(e.target.value)}>
        {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
      </SelectField>
      {countryZones.length > 1 && !showAll && (
        <p className="text-sm text-ink-soft">Quốc gia này có nhiều múi giờ. Hãy chọn đúng nơi bạn ở.</p>
      )}
      <label className="flex min-h-12 items-center gap-3 text-base">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="size-6 accent-wine" />
        Hiện tất cả múi giờ trên thế giới
      </label>
      <SubmitButton>Lưu</SubmitButton>
    </form>
  );
}
