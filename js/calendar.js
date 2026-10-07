// 営業カレンダーの計算。画面に触らない(テストできるように)。
import { pad2, iso } from './text.js?v=5';

export const monthKey = (y, m) => `${y}-${pad2(m)}`;

// m は 1〜12。first: 1日の曜日(0=日)、n: その月の日数
export function monthInfo(y, m) {
  return { y, m, first: new Date(y, m - 1, 1).getDay(), n: new Date(y, m, 0).getDate() };
}

// 定休日だけが入った、その月の状態。{ 日: 'c' }  c=お休み s=時間変更 なし=営業
export function regularMap(y, m, regular) {
  const { first, n } = monthInfo(y, m), map = {};
  for (let d = 1; d <= n; d++) if (regular.includes((first + d - 1) % 7)) map[d] = 'c';
  return map;
}

// 編集したものがあればそれを、なければ定休日どおりのものを返す
export const mapFor = (y, m, edited, regular) => edited[monthKey(y, m)] || regularMap(y, m, regular);

// タップするたび: 営業 → お休み → 時間変更 → 営業
export const nextState = s => (!s ? 'c' : s === 'c' ? 's' : '');

export function countDays(map) {
  const v = Object.values(map);
  return { closed: v.filter(x => x === 'c').length, changed: v.filter(x => x === 's').length };
}

const day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// m0 は 0〜11(Date と同じ)。その月に出すカレンダーの予定。
// P: 出す日、start: 知らせ始める日、ty / tm: 何年何月の分か
export function cycleFor(y, m0, st) {
  const P = new Date(y, m0, Math.min(+st.calday || 25, new Date(y, m0 + 1, 0).getDate()));
  const T = new Date(y, m0 + (st.caltarget === 'same' ? 0 : 1), 1);
  const start = new Date(P); start.setDate(start.getDate() - (+st.callead || 5));
  const ty = T.getFullYear(), tm = T.getMonth() + 1;
  return { P, start, ty, tm, key: monthKey(ty, tm), end: new Date(ty, tm, 0) };
}

// お知らせの状態
//   early: まだ早い(出さない)  due: 確認の時期  ok: 確認ずみ  late: 期限を過ぎた  done: 投稿まで済んだ(出さない)
// now: 今日、st: 設定、calok: { 'YYYY-MM': { at, done } }、firstUse: 使い始めた日 'YYYY-MM-DD'
export function noticeFor(now, st, calok, firstUse) {
  now = day0(now);
  const y = now.getFullYear(), m = now.getMonth();
  const next = cycleFor(y, m + 1, st), cur = cycleFor(y, m, st), prev = cycleFor(y, m - 1, st);
  const c = now >= next.start ? next : now >= cur.start ? cur : now <= prev.end ? prev : null;
  // アプリを使い始める前に出す予定だった分は、知らせない
  if (!c || iso(c.P) < firstUse) return { state: 'early' };
  const rec = calok[c.key] || null;
  const days = Math.round((c.P - now) / 86400000);
  const state = rec ? (rec.done ? 'done' : 'ok') : days < 0 ? 'late' : 'due';
  return { state, ...c, days, rec, now };
}

// 「お知らせの表示を試す」用の、仮の今日。
// mode: due=知らせ始めの日、late=出す日の次の日
export function simulatedNow(today, st, mode) {
  today = day0(today);
  const cur = cycleFor(today.getFullYear(), today.getMonth(), st);
  const c = today <= cur.P ? cur : cycleFor(today.getFullYear(), today.getMonth() + 1, st);
  if (mode === 'late') { const d = new Date(c.P); d.setDate(d.getDate() + 1); return d; }
  return today < c.start ? new Date(c.start) : today;
}
