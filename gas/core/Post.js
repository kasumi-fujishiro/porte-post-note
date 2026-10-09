// 自動投稿の状態の移り方と、知らせの日程。GASに頼らない部分(Node.jsでテストする)。
//
// 予約の状態:確認済み → 投稿中 → 投稿済み。ほかに 失敗、要確認、取り消し
// 投稿中の進み具合(phase):'' = まだ下書きなし / 'container' = 下書きあり / 'publishing' = 公開を送った(結果待ち)
//
// いちばん避けたいのは二重投稿。公開を送ったのに結果が分からないときは、自動ではやり直さず「要確認」にする。

const MAX_TRIES = 3;

// 「2026-10-25 12:03:00」の形(日本時間)から、日と時を取り出す
const dayOf = t => String(t).slice(0, 10);
const hourOf = t => +String(t).slice(11, 13);

// 予約を、この実行でどう扱うか
//   'post'    :投稿を始める(確認済みで、投稿する日時を過ぎている。または失敗のやり直し)
//   'resume'  :下書きの準備を待っている続き
//   'unknown' :公開を送ったが結果が分からない → 要確認にする
//   'restart' :下書きを作る前に止まっていた → 失敗としてやり直す
//   'wait'    :まだ何もしない
function decide(res, now, postHour) {
  if (!res || !res.state) return 'wait';
  if (res.state === '投稿中') {
    if (res.phase === 'publishing') return 'unknown';
    if (res.phase === 'container' && res.containerId) return 'resume';
    return 'restart';
  }
  const due = res.postDate && (dayOf(now) > res.postDate || (dayOf(now) === res.postDate && hourOf(now) >= +postHour));
  if (res.state === '確認済み') return due && res.publishedAt ? 'post' : 'wait';
  if (res.state === '失敗') {
    const tries = +res.tries || 0;
    if (res.tokenBad === 'TRUE' || tries >= MAX_TRIES) return 'wait';
    // 1時間あけてから、やり直す
    return minutesBetween(res.updatedAt, now) >= 55 ? 'post' : 'wait';
  }
  return 'wait';
}

function minutesBetween(a, b) {
  const t = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13), +s.slice(14, 16));
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(a || '') || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(b || '')) return Infinity;
  return (t(b) - t(a)) / 60000;
}

// 失敗したあとの状態。token: トークンが使えない(やり直しても成功しない)
function afterFailure(res, token) {
  const tries = (+res.tries || 0) + 1;
  return { state: '失敗', phase: '', tries: String(tries), tokenBad: token ? 'TRUE' : '', giveUp: token || tries >= MAX_TRIES };
}

// アプリと管理ページに出す知らせ(なければ null)。新しいものを優先する
function deriveAlert(reservations, tokenBad) {
  if (tokenBad) return { kind: 'token', message: 'Instagramに投稿するための鍵(トークン)が使えなくなりました。管理する人に、作り直しを頼んでください。' };
  const live = (reservations || []).filter(r => r.state === '要確認' || (r.state === '失敗' && ((+r.tries || 0) >= MAX_TRIES || r.tokenBad === 'TRUE')));
  if (!live.length) return null;
  const r = live.sort((a, b) => ((a.updatedAt || '') < (b.updatedAt || '') ? 1 : -1))[0];
  const m = /^(\d{4})-(\d{2})$/.exec(r.month || '');
  const label = m ? `${+m[2]}月の営業カレンダー` : '営業カレンダー';
  return r.state === '要確認'
    ? { kind: 'check', month: r.month, message: `${label}が、投稿できたか分かりません。お店の人用のページの「最近の投稿」で確かめてください。` }
    : { kind: 'failed', month: r.month, message: `${label}を、自動で投稿できませんでした。お店の人用のページから画像を保存して、手で投稿してください。` };
}

// 確認のお知らせをLINEで送る日か。返り値:送る文の種類 'notice1' | 'notice2' | ''
// state:その月(翌月の分)の状態 unconfirmed / confirmed / posted / undefined
function lineNoticeKind(now, sch, state) {
  const d = +String(now).slice(8, 10);
  if (state === 'confirmed' || state === 'posted') return '';
  if (d === +sch.notice1) return 'notice1';
  if (d === +sch.notice2) return 'notice2';
  return '';
}

// 期限の何日前か(期限の日が分からなければ null)
function daysUntil(today, limit) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limit || '')) return null;
  const t = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((t(limit) - t(String(today).slice(0, 10))) / 86400000);
}

// 最後に正しく動いた日時が、2日以上前か(空なら、まだ動いていないので出さない)
function isStale(lastOkAt, now) {
  if (!lastOkAt) return false;
  return minutesBetween(lastOkAt, now) >= 48 * 60;
}

if (typeof module !== 'undefined') module.exports = { MAX_TRIES, decide, afterFailure, deriveAlert, lineNoticeKind, daysUntil, isStale, minutesBetween };
