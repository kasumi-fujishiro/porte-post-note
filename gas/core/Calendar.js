// 営業カレンダーの確認と予約の決まり。GASに頼らない部分(Node.jsでテストする)。

// 「2026-11」の分を投稿する日(前の月の postDay 日)→「2026-10-25」
function postDateFor(month, postDay) {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 2, +postDay || 25);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 公開用の画像の場所。予約ごとに名前を変える(同じ名前だと、古い画像が残って届くことがあるため)
function imagePathFor(month, resId) {
  return `calendar/${month}-${String(resId).toLowerCase().replace(/[^a-z0-9]/g, '')}.jpg`;
}

// 管理ページから届いたカレンダーを検査する。days は { 日: 'c' | 's' }
function cleanCalendar(input) {
  const month = String((input && input.month) || '');
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: '月がちがいます。えらび直してください。' };
  const days = (input && input.days) || {};
  const text = daysToText(days);
  if (parseDays(text, month) === null) return { error: '日にちの状態がおかしいです。読み直してください。' };
  const note = String((input && input.note) || '').replace(/\s+/g, ' ').trim();
  if (note.length > 40) return { error: `ひとことは40文字以内にしてください(今は${note.length}文字です)。` };
  if (priceLike(note)) return { error: '価格のような文字が入っています。お店の方針で、価格は載せません。' };
  return { value: { month, daysText: text, note }, error: '' };
}

// まだ生きている予約(取り消しや投稿済みでないもの)
const LIVE_RES = ['確認済み', '投稿中', '失敗', '要確認'];

// 月ごとの状態:確認前 unconfirmed / 確認済み confirmed / 投稿済み posted
// calendarState は checkCalendars の結果。reservations は予約の行
function withPosted(calendarState, reservations) {
  const out = Object.assign({}, calendarState);
  (reservations || []).forEach(r => { if (r.state === '投稿済み' && out[r.month] === 'confirmed') out[r.month] = 'posted'; });
  return out;
}

if (typeof module !== 'undefined') module.exports = { postDateFor, imagePathFor, cleanCalendar, withPosted, LIVE_RES };
