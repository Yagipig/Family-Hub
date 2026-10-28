import { Avatar } from "@/components/Avatar";
import { signedUrl } from "@/lib/storage";

/**
 * Ảnh đại diện thành viên (Server Component): tự ký URL bằng quyền người xem.
 * `path` lấy từ members_view.avatar_path (đã che theo photo_visibility; null -> hiện chữ cái đầu).
 */
export async function MemberAvatar({ path, name, size = 48, className }: { path: string | null | undefined; name: string; size?: number; className?: string }) {
  const url = await signedUrl("avatars", path);
  return <Avatar src={url} name={name} size={size} className={className} />;
}
