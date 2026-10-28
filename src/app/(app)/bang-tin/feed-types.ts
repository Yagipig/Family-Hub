export const REACTIONS = [
  { kind: "heart", icon: "❤️", label: "Yêu thương" },
  { kind: "like", icon: "👍", label: "Thích" },
  { kind: "haha", icon: "😄", label: "Vui" },
  { kind: "wow", icon: "😮", label: "Ngạc nhiên" },
  { kind: "sad", icon: "😢", label: "Buồn" },
  { kind: "pray", icon: "🙏", label: "Cầu mong bình an" },
] as const;
export type ReactionKind = (typeof REACTIONS)[number]["kind"];

export type FeedMedia = { id: string; thumbUrl: string; fullUrl: string };
export type FeedPost = {
  id: string; authorName: string; authorMemberId: string | null; authorAvatarUrl: string | null;
  body: string; visibility: "family" | "branch"; pinned: boolean; hidden: boolean; hideReason: string | null;
  createdAt: string; editedAt: string | null; commentCount: number;
  reactions: Record<string, number>; myReaction: string | null;
  media: FeedMedia[]; canModerate: boolean; isMine: boolean;
};
export type FeedComment = {
  id: string; authorName: string; authorMemberId: string | null; authorAvatarUrl: string | null;
  body: string; createdAt: string; editedAt: string | null; canDelete: boolean; isMine: boolean;
};
export type FeedCursor = { before: string; beforeId: string };
export const FEED_PAGE_SIZE = 20;
