/** Dong chu bat buoc tren moi man hinh tro choi (khong import server-only de dung o ca client). */
export const NOTICE = "Điểm vui — không có giá trị tiền";

/** Ban NOTICE theo loai xu gia dinh dang chon (mac dinh la Diem). */
export function noticeFor(coinName: string): string {
  return `${coinName} vui — không có giá trị tiền`;
}
