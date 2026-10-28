import { NO_MONEY_NOTICE } from "@/lib/cards";

/** Dòng cảnh báo bắt buộc ở mọi nơi có lì xì / thông tin nhận tiền. */
export function NoMoneyNotice({ extra }: { extra?: string }) {
  return (
    <div role="note" className="rounded-xl border-2 border-champagne bg-champagne-soft px-4 py-3 text-base font-semibold text-ink">
      <p>{NO_MONEY_NOTICE}</p>
      {extra && <p className="mt-1 text-sm font-normal text-ink-soft">{extra}</p>}
    </div>
  );
}
