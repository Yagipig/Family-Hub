import { splitLinks } from "@/lib/chat-text";

/**
 * Hiển thị nội dung tin nhắn dạng văn bản thuần. React tự escape mọi ký tự, KHÔNG dùng dangerouslySetInnerHTML.
 * Chỉ liên kết http/https an toàn (xem safeHref) mới thành thẻ <a>.
 */
export function ChatMessageText({ body, linkClass = "" }: { body: string; linkClass?: string }) {
  return (
    <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      {splitLinks(body).map((seg, i) =>
        seg.type === "link" ? (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={`underline underline-offset-2 ${linkClass}`}
          >
            {seg.text}
          </a>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}
