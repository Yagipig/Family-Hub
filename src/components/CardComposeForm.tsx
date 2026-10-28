"use client";
import { useActionState, useMemo, useState } from "react";
import { CARD_TEMPLATES, EFFECT_LABELS, OCCASIONS, SUGGESTED_MESSAGES, getTemplate, type Occasion } from "@/lib/card-templates";
import { SUPPORTED_CURRENCIES, formatMinor, parseAmountToMinor } from "@/lib/cards-money";
import { formatInZone, utcOffsetLabel, zonedLocalToUtc } from "@/lib/cards-tz";
import type { Audience } from "@/lib/cards";
import type { FormState } from "@/lib/schemas";
import { Alert, Card, buttonGhostClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { CardThumb, CardView } from "@/components/CardView";
import { CardOpener } from "@/components/CardOpener";
import { NoMoneyNotice } from "@/components/CardsNotice";

export type ComposeInitial = {
  templateKey: string; title: string; message: string;
  audienceKind: "users" | "branch" | "family"; userIds: string[]; branchId: string;
  scheduledLocal: string; scheduled: boolean;
};

const MAX_CHARS = 2000;
const codePoints = (s: string) => [...s].length;
const field = "mt-1 block w-full min-h-12 rounded-xl border border-ink-soft/40 bg-white px-4 py-2 text-base text-ink";

export function CardComposeForm({
  action, audience, branches, senderName, senderTz, initialLocal, initial, editCardId, lockRecipients = false,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  audience: Audience[]; branches: { id: string; name: string }[];
  senderName: string; senderTz: string; initialLocal: string;
  initial?: ComposeInitial; editCardId?: string; lockRecipients?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const [templateKey, setTemplateKey] = useState(initial?.templateKey ?? CARD_TEMPLATES[0].key);
  const [occasion, setOccasion] = useState<"all" | Occasion>("all");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [kind, setKind] = useState<"users" | "branch" | "family">(initial?.audienceKind ?? "users");
  const [picked, setPicked] = useState<Set<string>>(new Set(initial?.userIds ?? []));
  const [branchId, setBranchId] = useState(initial?.branchId ?? "");
  const [query, setQuery] = useState("");
  const [when, setWhen] = useState<"now" | "later">(initial?.scheduled ? "later" : "now");
  const [local, setLocal] = useState(initial?.scheduledLocal || initialLocal);
  const [withGift, setWithGift] = useState(false);
  const [giftAmount, setGiftAmount] = useState("");
  const [giftCurrency, setGiftCurrency] = useState("VND");
  const [giftNote, setGiftNote] = useState("");
  const [showFx, setShowFx] = useState(false);

  const template = getTemplate(templateKey);
  const chars = codePoints(message);
  const visibleTemplates = CARD_TEMPLATES.filter((t) => occasion === "all" || t.occasion === occasion);
  const filtered = audience.filter((a) => a.display_name.toLowerCase().includes(query.trim().toLowerCase()));
  const recipientCount = kind === "users" ? picked.size : kind === "family" ? audience.length : null;

  const recipientsForTz: Audience[] = kind === "users" ? audience.filter((a) => picked.has(a.user_id)) : kind === "family" ? audience : audience.filter((a) => a.branch_id === branchId);
  const tzRows = useMemo(() => {
    const at = when === "later" ? zonedLocalToUtc(local, senderTz) : null;
    if (!at) return { at: null as Date | null, rows: [] as { tz: string; names: string[] }[] };
    const byTz = new Map<string, string[]>();
    for (const r of recipientsForTz) byTz.set(r.timezone, [...(byTz.get(r.timezone) ?? []), r.display_name]);
    return { at, rows: [...byTz.entries()].map(([tz, names]) => ({ tz, names })).filter((r) => r.tz !== senderTz) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when, local, senderTz, kind, picked, branchId, audience]);

  const giftAllowed = !editCardId && kind === "users" && picked.size >= 1 && picked.size <= 20;
  const giftMinor = withGift && giftAmount ? parseAmountToMinor(giftAmount, giftCurrency) : null;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!editCardId && (kind !== "users" || picked.size > 20)) {
          const who = kind === "family" ? `cả gia đình (${audience.length} người)` : kind === "branch" ? "cả nhánh đã chọn" : `${picked.size} người`;
          if (!window.confirm(`Gửi thiệp này cho ${who}?`)) e.preventDefault();
        }
      }}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]"
    >
      <input type="hidden" name="cardId" value={editCardId ?? ""} />
      <input type="hidden" name="templateKey" value={templateKey} />
      {kind === "users" && [...picked].map((id) => <input key={id} type="hidden" name="userIds" value={id} />)}

      <div className="space-y-6">
        {state?.error && <Alert kind="error">{state.error}</Alert>}

        <Card className="space-y-4">
          <h2 className="text-xl font-bold">1. Chọn mẫu thiệp</h2>
          <label className="block text-base font-semibold">
            Dịp
            <select value={occasion} onChange={(e) => setOccasion(e.target.value as "all" | Occasion)} className={field}>
              <option value="all">Tất cả các dịp</option>
              {Object.entries(OCCASIONS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <div role="radiogroup" aria-label="Mẫu thiệp" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visibleTemplates.map((t) => (
              <button key={t.key} type="button" role="radio" aria-checked={t.key === templateKey} onClick={() => { setTemplateKey(t.key); setShowFx(false); }}
                className={`rounded-2xl border-2 p-2 text-left ${t.key === templateKey ? "border-wine bg-champagne-soft" : "border-champagne/60 bg-ivory hover:bg-champagne-soft"}`}>
                <CardThumb template={t} />
                <span className="mt-2 block text-base font-bold">{t.name}</span>
                <span className="block text-sm text-ink-soft">{OCCASIONS[t.occasion]} · {EFFECT_LABELS[t.effect]}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-xl font-bold">2. Viết lời chúc</h2>
          <label className="block text-base font-semibold">
            Tiêu đề (không bắt buộc)
            <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={field} placeholder={`Ví dụ: ${getTemplate(templateKey).name}`} />
          </label>
          <label className="block text-base font-semibold">
            Lời chúc
            <textarea name="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={7} className={`${field} leading-relaxed`} required aria-describedby="msg-count" />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className={buttonGhostClass} onClick={() => setMessage(SUGGESTED_MESSAGES[template.occasion])}>Điền lời chúc gợi ý</button>
            <span id="msg-count" className={`text-base font-semibold ${chars > MAX_CHARS ? "text-danger" : "text-ink-soft"}`}>{chars}/{MAX_CHARS} ký tự</span>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-xl font-bold">3. Gửi cho ai</h2>
          {lockRecipients && <Alert kind="ok">Thiệp này đã kèm lì xì nên không đổi được người nhận. Bạn vẫn sửa được mẫu, lời chúc và giờ gửi.</Alert>}
          <fieldset className="space-y-2" disabled={lockRecipients}>
            <legend className="sr-only">Nhóm người nhận</legend>
            {([["users", "Chọn từng người"], ["branch", "Cả một nhánh họ"], ["family", `Cả gia đình (${audience.length} người)`]] as const).map(([k, label]) => (
              <label key={k} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-champagne/60 px-4 text-base font-semibold">
                <input type="radio" name="audienceKind" value={k} checked={kind === k} onChange={() => setKind(k)} className="h-5 w-5 accent-[#7b1e2b]" />
                {label}
              </label>
            ))}
          </fieldset>
          {kind === "users" && (
            <div className="space-y-3">
              <label className="block text-base font-semibold">
                Tìm tên
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} className={field} placeholder="Gõ tên để lọc danh sách" disabled={lockRecipients} />
              </label>
              <ul className="max-h-72 space-y-1 overflow-auto rounded-xl border border-champagne/60 p-2" aria-label="Danh sách người nhận">
                {filtered.length === 0 && <li className="px-2 py-3 text-base text-ink-soft">Không có ai khớp.</li>}
                {filtered.map((a) => (
                  <li key={a.user_id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 text-base hover:bg-champagne-soft">
                      <input type="checkbox" checked={picked.has(a.user_id)} onChange={() => toggle(a.user_id)} disabled={lockRecipients} className="h-5 w-5 accent-[#7b1e2b]" />
                      <span className="font-semibold">{a.display_name}</span>
                      <span className="text-sm text-ink-soft">{a.branch_name ?? "Chưa gán nhánh"}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="text-base font-semibold">Đã chọn: {picked.size} người{picked.size > 200 ? " (tối đa 200)" : ""}</p>
            </div>
          )}
          {kind === "branch" && (
            <label className="block text-base font-semibold">
              Nhánh họ
              <select name="branchId" value={branchId} onChange={(e) => setBranchId(e.target.value)} className={field} required disabled={lockRecipients}>
                <option value="">— Chọn nhánh —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <span className="mt-1 block text-sm font-normal text-ink-soft">Gửi cho mọi thành viên đang hoạt động của nhánh này và các nhánh con (tối đa 200 người).</span>
            </label>
          )}
          {kind === "family" && <p className="text-base text-ink-soft">Mọi thành viên đang hoạt động của gia đình sẽ nhận thiệp (tối đa 200 người).</p>}
        </Card>

        <Card className="space-y-4">
          <h2 className="text-xl font-bold">4. Thời gian gửi</h2>
          <fieldset className="space-y-2">
            <legend className="sr-only">Gửi ngay hay hẹn giờ</legend>
            {([["now", "Gửi ngay"], ["later", "Hẹn giờ gửi"]] as const).map(([k, label]) => (
              <label key={k} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-champagne/60 px-4 text-base font-semibold">
                <input type="radio" name="when" value={k} checked={when === k} onChange={() => setWhen(k)} className="h-5 w-5 accent-[#7b1e2b]" />
                {label}
              </label>
            ))}
          </fieldset>
          {when === "later" && (
            <div className="space-y-3">
              <label className="block text-base font-semibold">
                Ngày giờ gửi
                <input type="datetime-local" name="scheduledLocal" value={local} onChange={(e) => setLocal(e.target.value)} className={field} required />
              </label>
              <p className="rounded-xl bg-champagne-soft px-4 py-3 text-base">
                <strong>Giờ này tính theo múi giờ của BẠN:</strong> {senderTz} ({utcOffsetLabel(tzRows.at ?? new Date(), senderTz)}).
                {tzRows.at && <> Tương ứng thời điểm {formatInZone(tzRows.at, senderTz)}.</>}
              </p>
              {tzRows.at && tzRows.rows.length > 0 && (
                <div className="text-base">
                  <p className="font-semibold">Với người nhận ở múi giờ khác, thiệp hiện lúc:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-6">
                    {tzRows.rows.slice(0, 8).map((r) => (
                      <li key={r.tz}>{formatInZone(tzRows.at!, r.tz)} — {r.tz} ({r.names.slice(0, 3).join(", ")}{r.names.length > 3 ? ` và ${r.names.length - 3} người khác` : ""})</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-sm text-ink-soft">Trước giờ gửi, người nhận không nhìn thấy thiệp. Bạn vẫn xem, sửa hoặc huỷ được.</p>
            </div>
          )}
        </Card>

        {!editCardId && (
          <Card className="space-y-4">
            <h2 className="text-xl font-bold">5. Đính kèm lì xì (không bắt buộc)</h2>
            <NoMoneyNotice extra="Bạn tự chuyển tiền bằng ngân hàng/ví của bạn, rồi quay lại bấm “Tôi đã chuyển”. Người nhận bấm “Tôi đã nhận được”." />
            <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base font-semibold">
              <input type="checkbox" name="withGift" checked={withGift && giftAllowed} disabled={!giftAllowed} onChange={(e) => setWithGift(e.target.checked)} className="h-5 w-5 accent-[#7b1e2b]" />
              Kèm lời hẹn lì xì (chỉ ghi nhận)
            </label>
            {!giftAllowed && <p className="text-sm text-ink-soft">Chỉ đính kèm lì xì khi chọn từng người, tối đa 20 người.</p>}
            {withGift && giftAllowed && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-base font-semibold">
                  Số tiền ghi nhận (mỗi người)
                  <input name="giftAmount" inputMode="decimal" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value)} className={field} placeholder="Ví dụ: 500.000 (để trống nếu không ghi)" autoComplete="off" />
                </label>
                <label className="block text-base font-semibold">
                  Loại tiền
                  <select name="giftCurrency" value={giftCurrency} onChange={(e) => setGiftCurrency(e.target.value)} className={field}>
                    {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block text-base font-semibold sm:col-span-2">
                  Ghi chú (không bắt buộc)
                  <input name="giftNote" value={giftNote} onChange={(e) => setGiftNote(e.target.value)} maxLength={500} className={field} autoComplete="off" />
                </label>
                {giftAmount && giftMinor === null && <p className="text-base font-semibold text-danger sm:col-span-2">Số tiền chưa hợp lệ.</p>}
                {giftMinor !== null && (
                  <p className="text-base sm:col-span-2">
                    Mỗi người: <strong>{formatMinor(giftMinor, giftCurrency)}</strong>
                    {picked.size > 1 && <> · Tổng ghi nhận cho {picked.size} người: <strong>{formatMinor(giftMinor * picked.size, giftCurrency)}</strong></>}
                  </p>
                )}
              </div>
            )}
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingText="Đang gửi…">{editCardId ? "Lưu thay đổi" : when === "later" ? "Hẹn giờ gửi thiệp" : "Gửi thiệp"}</SubmitButton>
          {recipientCount !== null && <span className="text-base text-ink-soft">{recipientCount} người nhận</span>}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start" aria-label="Xem trước thiệp">
        <h2 className="text-xl font-bold">Xem trước</h2>
        <CardView template={template} title={title} message={message} senderName={senderName} />
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonGhostClass} onClick={() => setShowFx((v) => !v)}>{showFx ? "Ẩn hiệu ứng" : "Xem thử hiệu ứng mở"}</button>
        </div>
        {showFx && (
          <CardOpener key={templateKey + title + message.length} preview template={template} title={title} message={message || "Lời chúc của bạn sẽ hiện ở đây."} senderName={senderName} />
        )}
      </aside>
    </form>
  );
}
