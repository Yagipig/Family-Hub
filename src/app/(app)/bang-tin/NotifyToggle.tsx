"use client";
import { useState } from "react";
import { Alert } from "@/components/ui";
import { setNotificationsAction } from "./actions";

export function NotifyToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base font-semibold">
        <input type="checkbox" checked={on} disabled={busy} className="h-6 w-6 accent-wine"
          onChange={async (e) => {
            const v = e.target.checked;
            setBusy(true); setError(null);
            const r = await setNotificationsAction(v);
            setBusy(false);
            if (r.error) setError(r.error); else setOn(v);
          }} />
        Báo cho tôi khi có bình luận mới vào bài của tôi hoặc bài tôi đã bình luận
      </label>
      {error && <Alert kind="error">{error}</Alert>}
    </div>
  );
}
