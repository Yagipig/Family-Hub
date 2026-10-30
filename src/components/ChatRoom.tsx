"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  EDIT_WINDOW_MS, MAX_BODY, PAGE_SIZE, REASONS, REASON_KEYS, chatError, dayKey, formatClock, formatDay,
  isNetworkError, newClientId, normalizeBody,
  type ChatMessage, type ConversationKind, type LocalMessage, type RawMessageRow, type ReasonKind,
} from "@/lib/chat";
import {
  addPending, applyDelete, applyEdit, confirmSent, fromRaw, isGroupEnd, isGroupStart, latestConfirmedAt, markFailed, markSending,
  oldestConfirmedAt, removePending, startsNewDay, upsertMany, upsertServerMessage,
} from "@/lib/chat-state";
import { Avatar } from "@/components/Avatar";
import { ChatMessageText } from "@/components/ChatMessageText";
import { buttonClass, buttonGhostClass } from "@/components/ui";

type Props = {
  conversationId: string;
  kind: ConversationKind;
  me: { userId: string; displayName: string };
  timeZone: string;
  /** Có quyền gửi tin ở cuộc trò chuyện này không (vai trò cho phép). */
  canSend: boolean;
  /** Lý do không gửi được (đã chặn...), hiện thay cho khung soạn tin. */
  sendBlockedNote: string | null;
  /** Chủ nhóm / quản trị: được xoá tin của người khác. */
  canModerate: boolean;
  initialMessages: ChatMessage[];
  initialHasMore: boolean;
  members: { user_id: string; display_name: string }[];
};

type Conn = "connecting" | "online" | "offline" | "paused";

const IDLE_CLOSE_MS = 5 * 60_000; // tab ẩn quá 5 phút: huỷ kênh Realtime để nhường kết nối (giới hạn miễn phí)
const POLL_WHEN_OFFLINE_MS = 20_000;
const NEAR_BOTTOM_PX = 120;

const smallBtn =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-wine/60 px-3 py-1.5 text-sm font-semibold text-wine hover:bg-champagne-soft disabled:opacity-60 md:min-h-12 md:px-4 md:py-2 md:text-base";

export function ChatRoom({
  conversationId, kind, me, timeZone, canSend, sendBlockedNote, canModerate, initialMessages, initialHasMore, members,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<LocalMessage[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [conn, setConn] = useState<Conn>("connecting");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string; busy: boolean } | null>(null);
  const [reporting, setReporting] = useState<{ id: string; reason: ReasonKind; note: string; busy: boolean } | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [newBelow, setNewBelow] = useState(false);
  const [clientNow, setClientNow] = useState<number | null>(null);

  // ---- refs: giá trị mới nhất cho các callback bất đồng bộ ----
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const namesRef = useRef(new Map<string, string>([...members.map((m) => [m.user_id, m.display_name] as [string, string]), [me.userId, me.displayName]]));
  const listRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const restoreRef = useRef<{ height: number; top: number } | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const firstLayoutRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const resyncingRef = useRef(false);
  const lastMarkedRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Client-only "now" for time-sensitive UI (edit window). Prevents Date.now() during SSR/hydration.
  useEffect(() => {
    setClientNow(Date.now());
  }, []);

  const fmtDay = useCallback((iso: string) => dayKey(iso, timeZone), [timeZone]);

  // ------------------------------------------------------------------ Nạp dữ liệu
  const fetchPage = useCallback(
    async (opts: { before?: string; after?: string; limit: number }) => {
      let q = supabase.from("chat_messages_v").select("*").eq("conversation_id", conversationId);
      if (opts.after) q = q.gt("created_at", opts.after).order("created_at", { ascending: true });
      else {
        if (opts.before) q = q.lt("created_at", opts.before);
        q = q.order("created_at", { ascending: false });
      }
      const { data, error } = await q.limit(opts.limit);
      return { rows: ((data ?? []) as ChatMessage[]), error };
    },
    [supabase, conversationId],
  );

  const reloadRoster = useCallback(async () => {
    const { data } = await supabase.from("chat_members_v").select("user_id, display_name").eq("conversation_id", conversationId);
    for (const r of (data ?? []) as { user_id: string; display_name: string }[]) namesRef.current.set(r.user_id, r.display_name);
    setMessages((prev) =>
      prev.map((m) => (m.sender_name == null && m.sender_id && m.kind === "text" && namesRef.current.has(m.sender_id)
        ? { ...m, sender_name: namesRef.current.get(m.sender_id)! } : m)),
    );
  }, [supabase, conversationId]);

  /**
   * Đối soát sau (mất kết nối | quay lại tab | lần đăng ký Realtime đầu tiên):
   *  1) lấy mọi tin MỚI hơn tin cuối đã biết (lặp theo trang, tối đa 10 trang);
   *  2) nếu `refreshRecent`, lấy lại ~1 trang tin gần nhất để nhận các bản sửa/xoá bị lỡ.
   * Hợp nhất theo id nên không bao giờ trùng tin.
   */
  const resync = useCallback(
    async (refreshRecent: boolean) => {
      if (resyncingRef.current) return;
      resyncingRef.current = true;
      try {
        let since = latestConfirmedAt(messagesRef.current);
        for (let i = 0; i < 10; i++) {
          const { rows, error } = since
            ? await fetchPage({ after: since, limit: 100 })
            : await fetchPage({ limit: PAGE_SIZE });
          if (error) return;
          if (rows.length === 0) break;
          setMessages((prev) => upsertMany(prev, rows));
          if (!since) { setHasMore(rows.length === PAGE_SIZE); break; }
          since = rows[rows.length - 1].created_at;
          if (rows.length < 100) break;
        }
        if (refreshRecent) {
          const { rows, error } = await fetchPage({ limit: PAGE_SIZE });
          if (!error && rows.length) setMessages((prev) => upsertMany(prev, rows));
        }
      } finally {
        resyncingRef.current = false;
      }
    },
    [fetchPage],
  );

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasMoreRef.current) return;
    const cursor = oldestConfirmedAt(messagesRef.current);
    if (!cursor) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const { rows, error } = await fetchPage({ before: cursor, limit: PAGE_SIZE });
    if (error) {
      setNotice({ kind: "error", text: "Chưa tải được tin cũ hơn. Vui lòng thử lại." });
    } else {
      if (rows.length > 0) {
        const el = listRef.current;
        if (el) restoreRef.current = { height: el.scrollHeight, top: el.scrollTop };
        setMessages((prev) => upsertMany(prev, rows));
      }
      setHasMore(rows.length === PAGE_SIZE);
    }
    loadingOlderRef.current = false;
    setLoadingOlder(false);
  }, [fetchPage]);

  // ------------------------------------------------------------------ Realtime (một kênh cho cuộc trò chuyện đang mở)
  const handleRaw = useCallback(
    (raw: RawMessageRow, isUpdate: boolean) => {
      if (!raw || raw.conversation_id !== conversationId) return;
      setMessages((prev) => {
        // Bản sửa/xoá của tin chưa nạp (cũ hơn trang đang xem): bỏ qua, để danh sách luôn liền mạch cho phân trang
        if (isUpdate && !prev.some((m) => !m.status && m.id === raw.id)) return prev;
        return upsertServerMessage(prev, fromRaw(raw, namesRef.current, prev));
      });
      if (raw.kind === "text" && raw.sender_id && !namesRef.current.has(raw.sender_id)) void reloadRoster();
    },
    [conversationId, reloadRoster],
  );

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const open = () => {
      if (channel || disposed) return;
      setConn("connecting");
      const ch = supabase
        .channel(`chat:${conversationId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (p) => handleRaw(p.new as RawMessageRow, false))
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (p) => handleRaw(p.new as RawMessageRow, true))
        .subscribe((status) => {
          if (disposed || channel !== ch) return;
          if (status === "SUBSCRIBED") {
            setConn("online");
            void resync(true); // bù khoảng trống giữa lúc tải trang và lúc đăng ký / sau khi nối lại
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setConn("offline"); // supabase-js tự nối lại; khi SUBSCRIBED trở lại sẽ đối soát
          }
        });
      channel = ch;
    };
    const close = () => {
      if (channel) {
        const ch = channel;
        channel = null;
        void supabase.removeChannel(ch);
      }
    };

    open();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (!idleTimer) idleTimer = setTimeout(() => { close(); setConn("paused"); idleTimer = null; }, IDLE_CLOSE_MS);
      } else {
        if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
        if (!channel) open();
        else void resync(false); // trình duyệt di động có thể đã tạm dừng kết nối khi tab ẩn
      }
    };
    const onOnline = () => {
      if (!channel) open();
      void resync(true);
    };
    const onOffline = () => setConn("offline");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      disposed = true;
      if (idleTimer) clearTimeout(idleTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      close(); // huỷ đăng ký khi rời trang
    };
  }, [supabase, conversationId, handleRaw, resync]);

  // Khi Realtime không hoạt động: vẫn bổ sung tin mới bằng cách hỏi định kỳ (nhẹ, chỉ khi tab đang hiện)
  useEffect(() => {
    if (conn !== "offline") return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void resync(true);
    }, POLL_WHEN_OFFLINE_MS);
    return () => clearInterval(id);
  }, [conn, resync]);

  // ------------------------------------------------------------------ Đánh dấu đã đọc
  const markRead = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const latest = latestConfirmedAt(messagesRef.current);
    if (!latest || latest === lastMarkedRef.current) return;
    lastMarkedRef.current = latest;
    const { error } = await supabase.rpc("mark_read", { p_conversation: conversationId, p_upto: latest });
    if (error) lastMarkedRef.current = null; // thử lại lần sau
  }, [supabase, conversationId]);

  useEffect(() => {
    const t = setTimeout(() => void markRead(), 800);
    return () => clearTimeout(t);
  }, [messages, markRead]);
  useEffect(() => {
    const onVis = () => void markRead();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [markRead]);

  // ------------------------------------------------------------------ Cuộn
  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
    setNewBelow(false);
  }, []);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (restoreRef.current) {
      el.scrollTop = el.scrollHeight - restoreRef.current.height + restoreRef.current.top;
      restoreRef.current = null;
      return;
    }
    const last = messages[messages.length - 1];
    const key = last ? (last.client_id ?? last.id) : null;
    if (firstLayoutRef.current) {
      firstLayoutRef.current = false;
      scrollToBottom();
      lastKeyRef.current = key;
      return;
    }
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      if (atBottomRef.current || last?.sender_id === me.userId) scrollToBottom();
      else setNewBelow(true);
    }
  }, [messages, me.userId, scrollToBottom]);

  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (atBottomRef.current) setNewBelow(false);
    if (el.scrollTop < 48 && hasMoreRef.current) void loadOlder();
  }, [loadOlder]);

  // ------------------------------------------------------------------ Gửi (lạc quan, đối soát bằng client_id)
  const doSend = useCallback(
    async (p: { clientId: string; body: string; replyTo: string | null }) => {
      const { data, error } = await supabase.rpc("send_message", {
        p_conversation: conversationId, p_body: p.body, p_reply_to: p.replyTo, p_client_id: p.clientId,
      });
      if (error) {
        setMessages((prev) => markFailed(prev, p.clientId, isNetworkError(error) ? "network" : "rejected", chatError(error)));
        return;
      }
      const sent = data as { id: string; created_at: string };
      setMessages((prev) => confirmSent(prev, p.clientId, sent));
    },
    [supabase, conversationId],
  );

  function submitDraft() {
    if (!canSend) return;
    const parsed = normalizeBody(draft);
    if (!parsed.ok) {
      setNotice({ kind: "error", text: parsed.error });
      return;
    }
    setNotice(null);
    const clientId = newClientId();
    const reply = replyTo;
    const pending: LocalMessage = {
      id: clientId, conversation_id: conversationId, sender_id: me.userId, sender_name: me.displayName, kind: "text",
      body: parsed.body, reply_to: reply?.id ?? null, client_id: clientId, created_at: new Date().toISOString(), edited_at: null,
      deleted: false, reply_sender_name: reply?.sender_name ?? null,
      reply_body: reply && !reply.deleted ? reply.body.slice(0, 140) : null, reply_deleted: reply?.deleted ?? false,
      status: "sending",
    };
    atBottomRef.current = true;
    setMessages((prev) => addPending(prev, pending));
    setDraft("");
    setReplyTo(null);
    void doSend({ clientId, body: parsed.body, replyTo: reply?.id ?? null });
    textareaRef.current?.focus();
  }

  function retry(m: LocalMessage) {
    if (!m.client_id) return;
    const clientId = m.client_id;
    setMessages((prev) => markSending(prev, clientId));
    void doSend({ clientId, body: m.body, replyTo: m.reply_to });
  }

  // Có mạng trở lại: tự gửi lại các tin lỗi do mất mạng (an toàn nhờ client_id)
  useEffect(() => {
    const onOnline = () => {
      for (const m of messagesRef.current) if (m.status === "failed" && m.failReason === "network") retry(m);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doSend]);

  // Ô soạn tin tự giãn chiều cao theo nội dung (từ 1 dòng tới tối đa ~6 dòng rồi cuộn trong ô)
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [draft]);

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
    // Màn hình cảm ứng: Enter xuống dòng (đã có nút Gửi to). Máy tính: Enter gửi, Shift+Enter xuống dòng.
    const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    if (coarse) return;
    e.preventDefault();
    submitDraft();
  }

  // ------------------------------------------------------------------ Sửa / xoá / báo cáo
  async function saveEdit() {
    if (!editing) return;
    const parsed = normalizeBody(editing.text);
    if (!parsed.ok) return setNotice({ kind: "error", text: parsed.error });
    setEditing({ ...editing, busy: true });
    const { error } = await supabase.rpc("edit_message", { p_message: editing.id, p_body: parsed.body });
    if (error) {
      setEditing({ ...editing, busy: false });
      return setNotice({ kind: "error", text: chatError(error) });
    }
    setMessages((prev) => applyEdit(prev, editing.id, parsed.body, new Date().toISOString()));
    setEditing(null);
    setActiveId(null);
    setNotice({ kind: "ok", text: "Đã sửa tin nhắn." });
  }

  async function removeMessage(m: LocalMessage) {
    const own = m.sender_id === me.userId;
    const ask = own ? "Xoá tin nhắn này? Mọi người sẽ chỉ thấy “Tin nhắn đã bị xoá”." : "Xoá tin nhắn này của thành viên khác? Việc này sẽ được ghi vào nhật ký quản trị.";
    if (!window.confirm(ask)) return;
    const { error } = await supabase.rpc("delete_message", { p_message: m.id });
    if (error) return setNotice({ kind: "error", text: chatError(error) });
    setMessages((prev) => applyDelete(prev, m.id));
    setActiveId(null);
    setNotice({ kind: "ok", text: "Đã xoá tin nhắn." });
  }

  async function sendReport() {
    if (!reporting) return;
    setReporting({ ...reporting, busy: true });
    const { error } = await supabase.rpc("report_message", {
      p_message: reporting.id, p_reason_kind: reporting.reason, p_note: reporting.note.trim() || null,
    });
    if (error) {
      setReporting({ ...reporting, busy: false });
      return setNotice({ kind: "error", text: chatError(error) });
    }
    setReporting(null);
    setActiveId(null);
    setNotice({ kind: "ok", text: "Đã gửi báo cáo cho quản trị viên. Cảm ơn bạn." });
  }

  // ------------------------------------------------------------------ Giao diện
  const connText =
    conn === "online" ? null
    : conn === "paused" ? "Tạm dừng nhận tin tức thời vì tab đã ẩn lâu. Mở lại tab để tiếp tục."
    : conn === "offline" ? "Đang mất kết nối. Ứng dụng sẽ tự nối lại; tin mới vẫn được kiểm tra định kỳ."
    : "Đang kết nối…";

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[320px] flex-col overflow-hidden rounded-2xl border border-champagne/60 bg-ivory shadow-sm md:h-[calc(100dvh-14rem)]">
      {connText && (
        <p role="status" className="border-b border-champagne/60 bg-champagne-soft px-3 py-1.5 text-sm text-ink md:px-4 md:py-2 md:text-base">
          {connText}
        </p>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-label="Các tin nhắn"
          tabIndex={0}
          className="h-full overflow-y-auto px-2 py-3 sm:px-4 md:px-5"
        >
          {hasMore && (
            <div className="mb-4 text-center">
              <button type="button" className={smallBtn} onClick={() => void loadOlder()} disabled={loadingOlder}>
                {loadingOlder ? "Đang tải…" : "Xem tin cũ hơn"}
              </button>
            </div>
          )}
          {!hasMore && messages.length > 0 && <p className="mb-4 text-center text-base text-ink-soft">Đây là đầu cuộc trò chuyện.</p>}
          {messages.length === 0 && (
            <p className="py-10 text-center text-lg text-ink-soft">Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên!</p>
          )}

          <ul>
            {messages.map((m, idx) => {
              const prev = messages[idx - 1];
              const next = messages[idx + 1];
              const newDay = startsNewDay(prev, m, fmtDay);
              const own = m.sender_id === me.userId;
              // Cụm tin liên tiếp cùng người gửi: chỉ đầu cụm hiện tên + ảnh, chỉ cuối cụm hiện giờ gửi
              const groupStart = isGroupStart(prev, m, fmtDay);
              const groupEnd = isGroupEnd(m, next, fmtDay);
              const showName = !own && m.kind === "text" && kind !== "direct" && groupStart;
              const showMeta = groupEnd || activeId === m.id || editing?.id === m.id || reporting?.id === m.id || m.status != null;
              const rowKey = m.client_id ?? m.id;
              return (
                <li key={rowKey} className={m.kind === "text" && !newDay ? (groupStart ? "mt-4" : "mt-0.5") : undefined}>
                  {newDay && (
                    <div className="my-4 text-center" suppressHydrationWarning>
                      <span className="inline-block rounded-full bg-champagne-soft px-4 py-1 text-sm font-semibold text-ink-soft">{formatDay(m.created_at, timeZone)}</span>
                    </div>
                  )}
                  {m.kind === "system" ? (
                    <p className="my-2 text-center">
                      <span className="inline-block rounded-full bg-champagne-soft/70 px-4 py-1 text-sm font-medium text-ink-soft">{m.body}</span>
                    </p>
                  ) : (
	                    <MessageRow
	                      m={m}
	                      own={own}
	                      showName={showName}
	                      groupStart={groupStart}
	                      groupEnd={groupEnd}
	                      showMeta={showMeta}
	                      timeZone={timeZone}
	                      active={activeId === m.id}
	                      editing={editing?.id === m.id ? editing : null}
	                      reporting={reporting?.id === m.id ? reporting : null}
	                      canModerate={canModerate}
	                      clientNow={clientNow}
                      onToggle={() => { setActiveId((cur) => (cur === m.id ? null : m.id)); setEditing(null); setReporting(null); }}
                      onReply={() => { setReplyTo(m); setActiveId(null); textareaRef.current?.focus(); }}
                      onStartEdit={() => setEditing({ id: m.id, text: m.body, busy: false })}
                      onEditText={(text) => setEditing((e) => (e ? { ...e, text } : e))}
                      onSaveEdit={() => void saveEdit()}
                      onCancelEdit={() => setEditing(null)}
                      onDelete={() => void removeMessage(m)}
                      onStartReport={() => setReporting({ id: m.id, reason: "abuse", note: "", busy: false })}
                      onReportChange={(patch) => setReporting((r) => (r ? { ...r, ...patch } : r))}
                      onSendReport={() => void sendReport()}
                      onCancelReport={() => setReporting(null)}
                      onRetry={() => retry(m)}
                      onDiscard={() => m.client_id && setMessages((prev) => removePending(prev, m.client_id!))}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        {newBelow && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 inline-flex min-h-12 -translate-x-1/2 items-center rounded-full bg-wine px-5 py-2 text-base font-semibold text-white shadow-lg hover:bg-wine-dark"
          >
            Có tin mới ↓
          </button>
        )}
      </div>

      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`border-t px-4 py-2 text-base font-medium ${notice.kind === "error" ? "border-danger bg-red-50 text-danger" : "border-ok bg-green-50 text-ok"}`}
        >
          {notice.text}
        </p>
      )}

	      <div className="border-t border-champagne/60 bg-cream p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:p-3">
	        {!canSend || sendBlockedNote ? (
	          <p className="px-1 py-1.5 text-sm text-ink-soft md:text-base">{sendBlockedNote ?? "Tài khoản của bạn chưa được gửi tin nhắn."}</p>
	        ) : (
	          <>
	            {replyTo && (
	              <div className="mb-1.5 flex items-start gap-2 rounded-xl border-l-4 border-wine bg-white px-2 py-1.5 md:mb-2 md:gap-3 md:px-3 md:py-2">
	                <div className="min-w-0 flex-1 text-sm md:text-base">
	                  <div className="font-semibold text-wine">Trả lời {replyTo.sender_name ?? "thành viên"}</div>
	                  <div className="truncate text-ink-soft">{replyTo.deleted ? "Tin đã xoá" : replyTo.body}</div>
	                </div>
	                <button type="button" className={smallBtn} onClick={() => setReplyTo(null)} aria-label="Bỏ trả lời">Bỏ</button>
	              </div>
	            )}
	            <form onSubmit={(e) => { e.preventDefault(); submitDraft(); }} className="flex items-end gap-1.5 md:gap-2">
	              <label className="min-w-0 flex-1">
	                <span className="sr-only">Nội dung tin nhắn</span>
	                <textarea
	                  ref={textareaRef}
	                  value={draft}
	                  onChange={(e) => setDraft(e.target.value)}
	                  onKeyDown={onComposerKeyDown}
	                  maxLength={MAX_BODY}
	                  rows={1}
	                  placeholder="Nhập tin nhắn…"
	                  className="block max-h-[140px] min-h-[44px] w-full resize-none overflow-y-auto rounded-3xl border border-ink-soft/40 bg-white px-4 py-2.5 text-[15px] text-ink md:min-h-[52px] md:px-5 md:py-3 md:text-base"
	                />
	              </label>
	              <button type="submit" className={`${buttonClass} !min-h-[44px] shrink-0 !rounded-full px-4 text-sm md:!min-h-[52px] md:px-6 md:text-base`} disabled={draft.trim().length === 0}>
	                Gửi
	              </button>
	            </form>
	            <p className="mt-0.5 px-1 text-xs text-ink-soft md:mt-1 md:text-sm">
	              {draft.length > MAX_BODY - 500 ? `${draft.length}/${MAX_BODY} ký tự. ` : ""}
	              Chỉ chữ; sửa được trong 15 phút.
	            </p>
	          </>
	        )}
	      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
type RowProps = {
  m: LocalMessage;
  own: boolean;
  showName: boolean;
  /** Đầu cụm tin liên tiếp: hiện ảnh người gửi (và tên, do showName quyết định theo loại cuộc trò chuyện). */
  groupStart: boolean;
  /** Cuối cụm tin liên tiếp: bong bóng có góc “đuôi” nhỏ và hiện giờ gửi. */
  groupEnd: boolean;
  /** Hiện hàng giờ gửi/trạng thái/tuỳ chọn (cuối cụm, hoặc khi tin đang được thao tác). */
  showMeta: boolean;
  timeZone: string;
  active: boolean;
  editing: { id: string; text: string; busy: boolean } | null;
  reporting: { id: string; reason: ReasonKind; note: string; busy: boolean } | null;
  canModerate: boolean;
  onToggle: () => void;
  onReply: () => void;
  onStartEdit: () => void;
  onEditText: (t: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onStartReport: () => void;
  onReportChange: (patch: Partial<{ reason: ReasonKind; note: string }>) => void;
  onSendReport: () => void;
  onCancelReport: () => void;
	  onRetry: () => void;
	  onDiscard: () => void;
	  clientNow: number | null;
	};

function MessageRow(p: RowProps) {
  const { m, own } = p;
  const pending = m.status === "sending" || m.status === "failed";
  // Use clientNow (set after mount) so server render and first client render match (both treat as not editable yet)
  const canEdit = own && !pending && !m.deleted && p.clientNow !== null && (p.clientNow - Date.parse(m.created_at) < EDIT_WINDOW_MS);
  const canDelete = !pending && !m.deleted && (own || p.canModerate);
  const canReport = !pending && !m.deleted && !own;
  const senderName = m.sender_name ?? "Thành viên";
  const bubble = own
    ? "bg-wine text-white"
    : "border border-champagne/70 bg-white text-ink";
  // Góc “đuôi” nhỏ ở cuối cụm tin (phía dưới, hướng về phía người gửi) như Messenger
  const tail = p.groupEnd ? (own ? "rounded-br-md" : "rounded-bl-md") : "";
  const quote = own ? "border-white/70 bg-white/15 text-white" : "border-wine bg-champagne-soft text-ink";

  // Chạm vào bong bóng để mở/đóng tuỳ chọn của chính tin đó (tin giữa cụm không có hàng tuỳ chọn riêng).
  // Bỏ qua khi đang sửa tin, khi bấm trúng liên kết, hoặc khi người đọc đang bôi đen để sao chép.
  const onBubbleClick = p.editing ? undefined : (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) return;
    if (typeof window !== "undefined" && window.getSelection()?.toString()) return;
    p.onToggle();
  };

	  const bubbleBox = (
	      <div onClick={onBubbleClick} className={`max-w-[92%] rounded-2xl px-3 py-2 text-[15px] leading-snug sm:max-w-[78%] md:max-w-[75%] md:px-4 md:py-3 md:text-base ${tail} ${bubble} ${p.editing ? "" : "cursor-pointer"}`}>
	        {m.reply_to && (
	          <div className={`mb-1.5 rounded-lg border-l-4 px-2 py-0.5 text-sm md:mb-2 md:px-3 md:py-1 md:text-base ${quote}`}>
	            <div className="font-semibold">{m.reply_sender_name ?? "Tin nhắn"}</div>
	            <div className="line-clamp-2">{m.reply_deleted ? <em>Tin nhắn đã bị xoá</em> : (m.reply_body ?? "…")}</div>
	          </div>
	        )}
	        {m.deleted ? (
	          <em className={own ? "text-white/85" : "text-ink-soft"}>Tin nhắn đã bị xoá</em>
	        ) : p.editing ? (
	          <div className="space-y-2">
	            <label className="block">
	              <span className="sr-only">Sửa tin nhắn</span>
	              <textarea
	                value={p.editing.text}
	                onChange={(e) => p.onEditText(e.target.value)}
	                maxLength={MAX_BODY}
	                rows={3}
	                className="block w-full rounded-xl border border-ink-soft/40 bg-white px-3 py-2 text-[15px] text-ink md:text-base"
	              />
	            </label>
	            <div className="flex flex-wrap gap-2">
	              <button type="button" className={`${buttonClass} !bg-white !text-wine hover:!bg-champagne-soft !min-h-10 !text-sm md:!min-h-12 md:!text-base`} onClick={p.onSaveEdit} disabled={p.editing.busy}>
	                {p.editing.busy ? "Đang lưu…" : "Lưu"}
	              </button>
	              <button type="button" className={`${buttonGhostClass} !border-white !text-white hover:!bg-wine-dark !min-h-10 !text-sm md:!min-h-12 md:!text-base`} onClick={p.onCancelEdit}>Huỷ</button>
	            </div>
	          </div>
	        ) : (
	          <ChatMessageText body={m.body} linkClass={own ? "text-white" : "text-wine"} />
	        )}
	      </div>
	  );

	  // Hàng giờ gửi + trạng thái + nút tuỳ chọn: chỉ hiện ở cuối cụm (hoặc khi tin đang được thao tác/gửi lỗi)
	  const meta = p.showMeta ? (
	      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 px-1 text-xs text-ink-soft md:mt-1 md:gap-x-3 md:text-sm">
	        <time dateTime={m.created_at} suppressHydrationWarning>{formatClock(m.created_at, p.timeZone)}</time>
	        {m.edited_at && !m.deleted && <span>(đã sửa)</span>}
	        {own && m.status === "sending" && <span role="status">Đang gửi…</span>}
	        {own && !m.status && !m.deleted && <span>Đã gửi</span>}
	        {!pending && !m.deleted && !p.editing && (
	          <button
	            type="button"
	            onClick={p.onToggle}
	            aria-expanded={p.active}
	            className="inline-flex min-h-10 items-center px-1 text-sm font-semibold text-wine underline underline-offset-2 md:min-h-12 md:text-base"
	          >
	            {p.active ? "Đóng" : "Tuỳ chọn"}
	          </button>
	        )}
	      </div>
	  ) : null;

	  const failedBox = m.status === "failed" ? (
	        <div role="alert" className="mt-1 max-w-[92%] rounded-xl border border-danger bg-red-50 px-3 py-2 text-sm text-danger sm:max-w-[75%] md:text-base">
	          <p className="font-medium">{m.failText ?? "Chưa gửi được tin nhắn này."}</p>
	          <div className="mt-2 flex flex-wrap gap-2">
	            <button type="button" className={buttonClass} onClick={p.onRetry}>Gửi lại</button>
	            <button type="button" className={smallBtn} onClick={p.onDiscard}>Bỏ</button>
	          </div>
	        </div>
	  ) : null;

	  const options = p.active && !p.editing && !p.reporting ? (
	        <div className="mt-1 flex flex-wrap gap-1.5 md:gap-2" role="group" aria-label="Tuỳ chọn cho tin nhắn">
	          <button type="button" className={smallBtn} onClick={p.onReply}>Trả lời</button>
	          {canEdit && <button type="button" className={smallBtn} onClick={p.onStartEdit}>Sửa</button>}
	          {canDelete && <button type="button" className={`${smallBtn} !border-danger !text-danger`} onClick={p.onDelete}>Xoá</button>}
	          {canReport && <button type="button" className={smallBtn} onClick={p.onStartReport}>Báo cáo</button>}
	        </div>
	  ) : null;

  const reportForm = p.reporting ? (
        <div className="mt-2 w-full max-w-md space-y-3 rounded-xl border border-champagne bg-white p-4 text-ink">
          <p className="text-base font-semibold">Báo cáo tin nhắn này cho quản trị viên</p>
          <p className="text-sm text-ink-soft">Quản trị viên chỉ nhìn thấy nội dung tin này, không đọc được cả cuộc trò chuyện.</p>
          <label className="block text-base font-semibold">
            Lý do
            <select
              value={p.reporting.reason}
              onChange={(e) => p.onReportChange({ reason: e.target.value as ReasonKind })}
              className="mt-1 block min-h-12 w-full rounded-xl border border-ink-soft/40 bg-white px-3 py-2 text-base"
            >
              {REASON_KEYS.map((k) => <option key={k} value={k}>{REASONS[k]}</option>)}
            </select>
          </label>
          <label className="block text-base font-semibold">
            Ghi chú thêm (không bắt buộc)
            <textarea
              value={p.reporting.note}
              onChange={(e) => p.onReportChange({ note: e.target.value })}
              maxLength={500}
              rows={2}
              className="mt-1 block w-full rounded-xl border border-ink-soft/40 bg-white px-3 py-2 text-base"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={p.onSendReport} disabled={p.reporting.busy}>
              {p.reporting.busy ? "Đang gửi…" : "Gửi báo cáo"}
            </button>
            <button type="button" className={buttonGhostClass} onClick={p.onCancelReport}>Huỷ</button>
          </div>
        </div>
  ) : null;

  if (own) {
    return (
      <article className="flex flex-col items-end" aria-label={`Tin nhắn của bạn`}>
        {bubbleBox}
        {meta}
        {failedBox}
        {options}
        {reportForm}
      </article>
    );
  }

  // Tin của người khác: cột ảnh đại diện bên trái (chỉ hiện ở đầu cụm, các tin sau chừa chỗ trống
  // để bong bóng thẳng hàng), tên người nhắn hiện trên bong bóng đầu cụm trong nhóm.
  return (
    <article aria-label={`Tin nhắn của ${senderName}`}>
      <div className="flex items-start gap-2">
        <div className="w-9 shrink-0">
          {p.groupStart && <Avatar name={senderName} size={36} />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start">
          {p.showName && <span className="mb-1 pl-1 text-sm font-semibold text-ink-soft">{senderName}</span>}
          {bubbleBox}
          {meta}
          {failedBox}
          {options}
          {reportForm}
        </div>
      </div>
    </article>
  );
}
