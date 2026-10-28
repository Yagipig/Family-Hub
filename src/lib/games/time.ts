// Doi gio dia phuong (datetime-local, khong co mui gio) trong mot mui gio IANA sang thoi diem UTC. Khong can thu vien.

function tzOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(instantMs));
  const g = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return local - Math.floor(instantMs / 1000) * 1000;
}

/** "2027-02-05T20:00" tai mui gio timeZone -> Date (UTC). Tra ve null neu sai dinh dang / gio khong ton tai (vd. nhay gio mua he). */
export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const w = new Date(wall);
  if (w.getUTCFullYear() !== y || w.getUTCMonth() !== mo - 1 || w.getUTCDate() !== d || w.getUTCHours() !== h || w.getUTCMinutes() !== mi) return null; // vd. 30/02
  try {
    let guess = wall - tzOffsetMs(wall, timeZone);
    guess = wall - tzOffsetMs(guess, timeZone);
    // doi chieu lai: gio dia phuong cua ket qua phai dung bang dau vao
    if (tzOffsetMs(guess, timeZone) + guess !== wall) return null;
    return new Date(guess);
  } catch {
    return null;
  }
}
