import { describe, expect, it } from "vitest";
import type { ChatMessage, LocalMessage, RawMessageRow } from "./chat";
import {
  addPending, applyDelete, applyEdit, confirmSent, fromRaw, isGroupEnd, isGroupStart, latestConfirmedAt, markFailed, markSending,
  oldestConfirmedAt, removePending, sameGroup, tsKey, upsertMany, upsertServerMessage,
} from "./chat-state";

const CONV = "c0000000-0000-4000-8000-000000000001";
const ME = "a0000000-0000-4000-8000-000000000001";
const OTHER = "a0000000-0000-4000-8000-000000000002";

function msg(over: Partial<ChatMessage> & { id: string }): ChatMessage {
  return {
    conversation_id: CONV, sender_id: OTHER, sender_name: "Bác Hai", kind: "text", body: "xin chào", reply_to: null,
    client_id: null, created_at: "2026-10-28T10:00:00.000000+00:00", edited_at: null, deleted: false,
    reply_sender_name: null, reply_body: null, reply_deleted: false, ...over,
  };
}
function pending(clientId: string, body = "tin của tôi"): LocalMessage {
  return msg({ id: clientId, client_id: clientId, sender_id: ME, sender_name: "Tôi", body, created_at: "2026-10-28T10:05:00.000Z" });
}

describe("tin đang gửi và đối soát", () => {
  it("Realtime về TRƯỚC khi RPC trả lời: chỉ còn một tin", () => {
    let list: LocalMessage[] = [msg({ id: "m1" })];
    list = addPending(list, pending("k1"));
    list = upsertServerMessage(list, msg({ id: "s1", client_id: "k1", sender_id: ME, body: "tin của tôi", created_at: "2026-10-28T10:05:01.000000+00:00" }));
    expect(list.map((m) => m.id)).toEqual(["m1", "s1"]);
    list = confirmSent(list, "k1", { id: "s1", created_at: "2026-10-28T10:05:01.000000+00:00" });
    expect(list.map((m) => m.id)).toEqual(["m1", "s1"]);
    expect(list.every((m) => !m.status)).toBe(true);
  });

  it("RPC trả lời TRƯỚC Realtime: tin tạm thành tin thật, Realtime đến sau không nhân đôi", () => {
    let list: LocalMessage[] = [];
    list = addPending(list, pending("k1"));
    expect(list[0].status).toBe("sending");
    list = confirmSent(list, "k1", { id: "s1", created_at: "2026-10-28T10:05:01.000000+00:00" });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("s1");
    expect(list[0].status).toBeUndefined();
    list = upsertServerMessage(list, msg({ id: "s1", client_id: "k1", sender_id: ME, sender_name: null, body: "tin của tôi", created_at: "2026-10-28T10:05:01.000000+00:00" }));
    expect(list).toHaveLength(1);
    expect(list[0].sender_name).toBe("Tôi"); // không mất tên khi Realtime chưa biết tên
  });

  it("cùng một sự kiện Realtime đến hai lần: không trùng", () => {
    let list: LocalMessage[] = [];
    const m = msg({ id: "m1" });
    list = upsertServerMessage(list, m);
    list = upsertServerMessage(list, m);
    expect(list).toHaveLength(1);
  });

  it("bấm gửi hai lần cùng client_id: không thêm tin tạm thứ hai", () => {
    let list: LocalMessage[] = [];
    list = addPending(list, pending("k1"));
    list = addPending(list, pending("k1"));
    expect(list).toHaveLength(1);
  });

  it("tin đang gửi luôn nằm cuối dù đồng hồ máy lệch", () => {
    let list: LocalMessage[] = [msg({ id: "m1", created_at: "2026-10-28T11:00:00.000000+00:00" })];
    list = addPending(list, { ...pending("k1"), created_at: "2020-01-01T00:00:00.000Z" });
    list = upsertServerMessage(list, msg({ id: "m2", created_at: "2026-10-28T11:30:00.000000+00:00" }));
    expect(list.map((m) => m.id)).toEqual(["m1", "m2", "k1"]);
  });

  it("gửi lỗi rồi gửi lại cùng client_id: trạng thái đúng, thành công thì thành tin thật", () => {
    let list: LocalMessage[] = addPending([], pending("k1"));
    list = markFailed(list, "k1", "network", "mất mạng");
    expect(list[0]).toMatchObject({ status: "failed", failReason: "network", failText: "mất mạng" });
    list = markSending(list, "k1");
    expect(list[0]).toMatchObject({ status: "sending" });
    expect(list[0].failText).toBeUndefined();
    list = confirmSent(list, "k1", { id: "s1", created_at: "2026-10-28T10:06:00.000000+00:00" });
    expect(list).toEqual([expect.objectContaining({ id: "s1" })]);
    expect(list[0].status).toBeUndefined();
  });

  it("người dùng bỏ tin lỗi: tin tạm biến mất", () => {
    let list: LocalMessage[] = addPending([], pending("k1"));
    list = markFailed(list, "k1", "rejected", "bị từ chối");
    list = removePending(list, "k1");
    expect(list).toHaveLength(0);
  });

  it("confirmSent sau khi tin tạm đã bị thay: không đổi gì", () => {
    const list: LocalMessage[] = [msg({ id: "s1", client_id: "k1" })];
    expect(confirmSent(list, "k1", { id: "s1", created_at: "x" })).toBe(list);
  });
});

describe("sắp xếp và bổ sung tin bị lỡ", () => {
  it("giữ thứ tự theo created_at kể cả khi tin về lộn xộn", () => {
    let list: LocalMessage[] = [];
    list = upsertServerMessage(list, msg({ id: "b", created_at: "2026-10-28T10:00:02.000000+00:00" }));
    list = upsertServerMessage(list, msg({ id: "a", created_at: "2026-10-28T10:00:01.000000+00:00" }));
    list = upsertServerMessage(list, msg({ id: "c", created_at: "2026-10-28T10:00:03.000000+00:00" }));
    expect(list.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("bổ sung sau mất kết nối: hai trang chồng lấn không sinh tin trùng, lấy được bản sửa/xoá mới", () => {
    let list: LocalMessage[] = upsertMany([], [
      msg({ id: "m1", created_at: "2026-10-28T10:00:01.000000+00:00" }),
      msg({ id: "m2", created_at: "2026-10-28T10:00:02.000000+00:00", body: "cũ" }),
      msg({ id: "m3", created_at: "2026-10-28T10:00:03.000000+00:00" }),
    ]);
    list = upsertMany(list, [
      msg({ id: "m2", created_at: "2026-10-28T10:00:02.000000+00:00", body: "đã sửa", edited_at: "2026-10-28T10:01:00.000000+00:00" }),
      msg({ id: "m3", created_at: "2026-10-28T10:00:03.000000+00:00", deleted: true, body: "" }),
      msg({ id: "m4", created_at: "2026-10-28T10:00:04.000000+00:00" }),
    ]);
    expect(list.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
    expect(list[1]).toMatchObject({ body: "đã sửa" });
    expect(list[2]).toMatchObject({ deleted: true, body: "" });
  });

  it("tin đã xoá không bao giờ sống lại, kể cả khi nhận bản cũ muộn", () => {
    let list: LocalMessage[] = [msg({ id: "m1", deleted: true, body: "" })];
    list = upsertServerMessage(list, msg({ id: "m1", deleted: false, body: "nội dung cũ" }));
    expect(list[0]).toMatchObject({ deleted: true, body: "" });
  });

  it("latestConfirmedAt / oldestConfirmedAt bỏ qua tin đang gửi", () => {
    let list: LocalMessage[] = upsertMany([], [
      msg({ id: "m1", created_at: "2026-10-28T10:00:01.000000+00:00" }),
      msg({ id: "m2", created_at: "2026-10-28T10:00:02.000000+00:00" }),
    ]);
    list = addPending(list, { ...pending("k1"), created_at: "2030-01-01T00:00:00.000Z" });
    expect(latestConfirmedAt(list)).toBe("2026-10-28T10:00:02.000000+00:00");
    expect(oldestConfirmedAt(list)).toBe("2026-10-28T10:00:01.000000+00:00");
    expect(latestConfirmedAt([])).toBeNull();
  });
});

describe("chuyển dòng thô từ Realtime", () => {
  const raw = (over: Partial<RawMessageRow>): RawMessageRow => ({
    id: "r1", conversation_id: CONV, sender_id: OTHER, kind: "text", body: "chào", reply_to: null, client_id: null,
    created_at: "2026-10-28T10:00:00.000000+00:00", edited_at: null, deleted_at: null, ...over,
  });
  const names = new Map([[OTHER, "Bác Hai"]]);

  it("gắn tên người gửi từ danh sách thành viên; không biết thì để null (để giao diện tải lại danh sách)", () => {
    expect(fromRaw(raw({}), names, []).sender_name).toBe("Bác Hai");
    expect(fromRaw(raw({ sender_id: "ai-do" }), names, []).sender_name).toBeNull();
  });

  it("xem trước tin được trả lời lấy từ danh sách đang có", () => {
    const list: LocalMessage[] = [msg({ id: "orig", body: "Tin gốc", sender_name: "Chú Ba" })];
    const m = fromRaw(raw({ reply_to: "orig" }), names, list);
    expect(m).toMatchObject({ reply_body: "Tin gốc", reply_sender_name: "Chú Ba", reply_deleted: false });
  });

  it("tin gốc đã xoá: không lộ nội dung", () => {
    const list: LocalMessage[] = [msg({ id: "orig", body: "", deleted: true })];
    expect(fromRaw(raw({ reply_to: "orig" }), names, list)).toMatchObject({ reply_body: null, reply_deleted: true });
  });

  it("dòng bị xoá mềm: body rỗng và deleted = true", () => {
    expect(fromRaw(raw({ deleted_at: "2026-10-28T10:00:05+00:00", body: "" }), names, [])).toMatchObject({ deleted: true, body: "" });
  });

  it("tin hệ thống không có tên người gửi", () => {
    expect(fromRaw(raw({ kind: "system", sender_id: null, body: "A đã tạo nhóm" }), names, []).sender_name).toBeNull();
  });
});

describe("sửa / xoá tại chỗ", () => {
  it("applyEdit chỉ đổi tin chưa xoá", () => {
    let list: LocalMessage[] = [msg({ id: "m1", body: "a" }), msg({ id: "m2", body: "", deleted: true })];
    list = applyEdit(list, "m1", "b", "2026-10-28T10:02:00.000Z");
    list = applyEdit(list, "m2", "c", "2026-10-28T10:02:00.000Z");
    expect(list[0]).toMatchObject({ body: "b", edited_at: "2026-10-28T10:02:00.000Z" });
    expect(list[1]).toMatchObject({ body: "", deleted: true });
  });

  it("applyDelete xoá nội dung và che phần trích dẫn trong các tin trả lời", () => {
    let list: LocalMessage[] = [
      msg({ id: "orig", body: "bí mật" }),
      msg({ id: "r", reply_to: "orig", reply_body: "bí mật", reply_sender_name: "Bác Hai" }),
    ];
    list = applyDelete(list, "orig");
    expect(list[0]).toMatchObject({ deleted: true, body: "" });
    expect(list[1]).toMatchObject({ reply_deleted: true, reply_body: null });
  });
});

describe("cụm tin liên tiếp (kiểu Messenger)", () => {
  const dayOf = (iso: string) => iso.slice(0, 10); // test dùng ngày UTC cho gọn
  const at = (id: string, sender: string | null, time: string, over: Partial<ChatMessage> = {}) =>
    msg({ id, sender_id: sender, created_at: `2026-10-28T${time}.000000+00:00`, ...over });

  it("cùng người gửi, cùng ngày: cùng một cụm, chỉ đầu cụm mở đầu và cuối cụm kết thúc", () => {
    const a = at("a", OTHER, "10:00:00");
    const b = at("b", OTHER, "10:01:00");
    const c = at("c", OTHER, "10:02:00");
    expect(sameGroup(a, b, dayOf)).toBe(true);
    expect(isGroupStart(undefined, a, dayOf)).toBe(true);
    expect(isGroupStart(a, b, dayOf)).toBe(false);
    expect(isGroupEnd(a, b, dayOf)).toBe(false);
    expect(isGroupEnd(b, c, dayOf)).toBe(false);
    expect(isGroupEnd(c, undefined, dayOf)).toBe(true);
  });

  it("khác người gửi thì cắt cụm", () => {
    const a = at("a", OTHER, "10:00:00");
    const b = at("b", ME, "10:01:00");
    expect(sameGroup(a, b, dayOf)).toBe(false);
    expect(isGroupStart(a, b, dayOf)).toBe(true);
    expect(isGroupEnd(a, b, dayOf)).toBe(true);
  });

  it("tin hệ thống chen giữa thì cắt cụm; bản thân tin hệ thống không thuộc cụm nào", () => {
    const a = at("a", OTHER, "10:00:00");
    const sys = at("s", null, "10:01:00", { kind: "system", sender_name: null });
    const b = at("b", OTHER, "10:02:00");
    expect(sameGroup(a, sys, dayOf)).toBe(false);
    expect(sameGroup(sys, b, dayOf)).toBe(false);
    expect(isGroupStart(a, sys, dayOf)).toBe(false);
    expect(isGroupEnd(sys, b, dayOf)).toBe(false);
    expect(isGroupStart(sys, b, dayOf)).toBe(true);
  });

  it("sang ngày mới thì cắt cụm dù cùng người gửi", () => {
    const a = msg({ id: "a", sender_id: OTHER, created_at: "2026-10-28T23:59:00.000000+00:00" });
    const b = msg({ id: "b", sender_id: OTHER, created_at: "2026-10-29T00:01:00.000000+00:00" });
    expect(sameGroup(a, b, dayOf)).toBe(false);
  });

  it("người gửi không xác định (sender null) không gộp cụm với ai", () => {
    const a = at("a", null, "10:00:00", { sender_name: null });
    const b = at("b", null, "10:01:00", { sender_name: null });
    expect(sameGroup(a, b, dayOf)).toBe(false);
    expect(isGroupStart(a, b, dayOf)).toBe(true);
  });
});

describe("tsKey / so sánh thời gian", () => {
  it("so sánh đúng khi chuỗi có số chữ số lẻ khác nhau (Postgres bỏ số 0 cuối) hoặc dùng Z", () => {
    expect(tsKey("2026-10-28T10:00:00.12345+00:00") < tsKey("2026-10-28T10:00:00.123456+00:00")).toBe(true);
    expect(tsKey("2026-10-28T10:00:00+00:00") < tsKey("2026-10-28T10:00:00.5+00:00")).toBe(true);
    expect(tsKey("2026-10-28T10:00:00.5Z")).toBe(tsKey("2026-10-28T10:00:00.500000+00:00"));
    expect(tsKey("2026-10-28T10:00:01+00:00") > tsKey("2026-10-28T10:00:00.999999+00:00")).toBe(true);
  });
  it("sắp xếp tin theo thời gian dù định dạng chuỗi khác nhau", () => {
    let list: LocalMessage[] = [];
    list = upsertServerMessage(list, msg({ id: "b", created_at: "2026-10-28T10:00:00.123456+00:00" }));
    list = upsertServerMessage(list, msg({ id: "a", created_at: "2026-10-28T10:00:00.12345+00:00" }));
    list = upsertServerMessage(list, msg({ id: "c", created_at: "2026-10-28T10:00:00.2+00:00" }));
    expect(list.map((m) => m.id)).toEqual(["a", "b", "c"]);
    expect(latestConfirmedAt(list)).toBe("2026-10-28T10:00:00.2+00:00");
    expect(oldestConfirmedAt(list)).toBe("2026-10-28T10:00:00.12345+00:00");
  });
});
