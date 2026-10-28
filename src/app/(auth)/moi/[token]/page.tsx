import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABELS, type Role } from "@/lib/auth";
import { Card } from "@/components/ui";
import { RedeemForm } from "./RedeemForm";

export const metadata = { title: "Lời mời" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = /^[0-9a-f]{48}$/.test(token);
  const { data } = valid ? await createAdminClient().rpc("peek_invitation", { p_token: token }) : { data: null };
  const invite = data?.[0];

  if (!invite) {
    return (
      <Card>
        <h2 className="text-xl font-bold">Lời mời không dùng được</h2>
        <p className="mt-2 text-base text-ink-soft">
          Liên kết có thể đã hết hạn, đã được dùng hoặc bị thu hồi. Hãy nhờ quản trị viên gửi lời mời mới.
        </p>
      </Card>
    );
  }
  return (
    <RedeemForm
      token={token}
      familyName={invite.family_name}
      roleLabel={ROLE_LABELS[invite.role_key as Role] ?? invite.role_key}
      lockedEmail={invite.email}
    />
  );
}
