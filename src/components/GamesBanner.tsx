import { NOTICE } from "@/lib/games/notice";

/** Dong nhac co dinh tren moi man hinh tro choi: chi la diem ao. */
export function GamesBanner() {
  return (
    <p role="note" className="rounded-xl border border-champagne bg-champagne-soft px-4 py-3 text-base font-semibold text-wine-dark">
      {NOTICE}. Chơi cho vui cùng gia đình, không đổi ra tiền.
    </p>
  );
}
