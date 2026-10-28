"use client";
import Link from "next/link";
import { useState } from "react";
import { MemberPicker } from "@/components/MemberPicker";
import { ConfirmButton } from "@/components/SubmitButton";
import { buttonClass } from "@/components/ui";
import type { PickerMember } from "@/lib/members-types";

export type LinkerAccount = {
  membershipId: string; name: string; roleLabel: string; branchName: string | null;
  memberId: string | null; memberName: string | null; suggestion: { id: string; name: string } | null;
};

type Action = (formData: FormData) => void | Promise<void>;

function Row({ a, members, linkedIds, linkAction, unlinkAction }: {
  a: LinkerAccount; members: PickerMember[]; linkedIds: string[]; linkAction: Action; unlinkAction: Action;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="space-y-3 py-4">
      <div>
        <p className="text-lg font-semibold">{a.name}</p>
        <p className="text-sm text-ink-soft">{a.roleLabel}{a.branchName ? ` · Nhánh ${a.branchName}` : ""}</p>
      </div>
      {a.memberId ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base">Đã gắn với hồ sơ: <Link className="font-semibold text-wine underline" href={`/thanh-vien/${a.memberId}`}>{a.memberName ?? "(không xem được)"}</Link></span>
          <form action={unlinkAction}>
            <input type="hidden" name="membershipId" value={a.membershipId} />
            <ConfirmButton message={`Gỡ liên kết giữa tài khoản “${a.name}” và hồ sơ này?`}
              className="min-h-12 rounded-xl border border-danger px-4 text-base font-semibold text-danger hover:bg-red-50">Gỡ liên kết</ConfirmButton>
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-base text-ink-soft">Chưa gắn với hồ sơ nào.</p>
          {a.suggestion && (
            <form action={linkAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="membershipId" value={a.membershipId} />
              <input type="hidden" name="memberId" value={a.suggestion.id} />
              <span className="text-base">Gợi ý trùng tên: <strong>{a.suggestion.name}</strong></span>
              <button className={buttonClass}>Gắn với hồ sơ này</button>
            </form>
          )}
          {!open ? (
            <button type="button" onClick={() => setOpen(true)}
              className="min-h-12 rounded-xl border border-wine px-5 text-base font-semibold text-wine hover:bg-champagne-soft">Chọn hồ sơ khác để gắn</button>
          ) : (
            <form action={linkAction} className="space-y-3 rounded-xl border border-champagne/60 p-4">
              <input type="hidden" name="membershipId" value={a.membershipId} />
              <MemberPicker name="memberId" label="Hồ sơ cần gắn" members={members} excludeIds={linkedIds}
                hint="Chỉ hiện hồ sơ chưa gắn với tài khoản nào. Gõ một phần tên (không cần dấu)." />
              <div className="flex gap-3">
                <button className={buttonClass}>Gắn hồ sơ</button>
                <button type="button" onClick={() => setOpen(false)}
                  className="min-h-12 rounded-xl border border-wine px-5 text-base font-semibold text-wine hover:bg-champagne-soft">Đóng</button>
              </div>
            </form>
          )}
        </div>
      )}
    </li>
  );
}

export function AccountLinker(props: { accounts: LinkerAccount[]; members: PickerMember[]; linkAction: Action; unlinkAction: Action }) {
  const linkedIds = props.accounts.map((a) => a.memberId).filter((x): x is string => !!x);
  return (
    <ul className="divide-y divide-champagne/50">
      {props.accounts.map((a) => (
        <Row key={a.membershipId} a={a} members={props.members} linkedIds={linkedIds} linkAction={props.linkAction} unlinkAction={props.unlinkAction} />
      ))}
    </ul>
  );
}
