// 営業カレンダーの計算。画面に触らない(テストできるように)。
import { pad2, iso } from './text.js?v=11';

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

// 日程(sch):{ notice1: 知らせる日(20), notice2: もう一度知らせる日(23), postDay: 投稿する日(25) }
// m0 は 0〜11(Date と同じ)。その月に出す、翌月の分のカレンダーの予定。
// P: 投稿する日、start: 知らせ始める日、ty / tm: 何年何月の分か、end: その月の終わり
export function cycleFor(y, m0, sch) {
  const P = new Date(y, m0, +sch.postDay || 25), start = new Date(y, m0, +sch.notice1 || 20);
  const T = new Date(y, m0 + 1, 1), ty = T.getFullYear(), tm = T.getMonth() + 1;
  return { P, start, ty, tm, key: monthKey(ty, tm), end: new Date(ty, tm, 0) };
}

// お知らせの状態
//   early: まだ早い(出さない)  due: 確認の時期  ok: 確認ずみ  late: 期限を過ぎた  done: 投稿済み(出さない)
// now: 今日、sch: 日程、states: { 'YYYY-MM': 'unconfirmed' | 'confirmed' | 'posted' }、firstUse: 使い始めた日
export function noticeFor(now, sch, states, firstUse) {
  now = day0(now);
  const y = now.getFullYear(), m = now.getMonth();
  const cur = cycleFor(y, m, sch), prev = cycleFor(y, m - 1, sch);
  const c = now >= cur.start ? cur : now <= prev.end ? prev : null;
  // アプリを使い始める前に出す予定だった分は、知らせない(使い始めた日が分からないときも出さない)
  if (!c || !firstUse || iso(c.P) < firstUse) return { state: 'early' };
  const st = (states || {})[c.key];
  const days = Math.round((c.P - now) / 86400000);
  const state = st === 'posted' ? 'done' : st === 'confirmed' ? 'ok' : days < 0 ? 'late' : 'due';
  return { state, ...c, days, now };
}

// 「お知らせの表示を試す」用の、仮の今日。mode: due=知らせ始めの日、late=投稿する日の次の日
export function simulatedNow(today, sch, mode) {
  today = day0(today);
  const cur = cycleFor(today.getFullYear(), today.getMonth(), sch);
  const c = today <= cur.P ? cur : cycleFor(today.getFullYear(), today.getMonth() + 1, sch);
  if (mode === 'late') { const d = new Date(c.P); d.setDate(d.getDate() + 1); return d; }
  return today < c.start ? new Date(c.start) : today;
}
